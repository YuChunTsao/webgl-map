import { VectorTile } from '@mapbox/vector-tile';
import type { ParseLayer, TileDrawCommand } from './types';
import { PbfReader } from 'pbf';
import type { GeoJSON, Feature } from 'geojson';
import { geoJSONToDrawCommands, type ProjectFunction } from './geometry-draw';
import { lngLatToMercator } from './mercator';

export async function fetchTile(
  url: string,
  signal: AbortSignal,
): Promise<ArrayBuffer | null> {
  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`HTTP ${response.status} ${response.statusText}`);

  return await response.arrayBuffer();
}

export function parseTile(
  data: ArrayBuffer,
  z: number,
  x: number,
  y: number,
  layers: ParseLayer[],
): TileDrawCommand[] {
  const tile = new VectorTile(new PbfReader(data));
  const commands: TileDrawCommand[] = [];

  // Calculate the tile local from mercator coordinate
  const n = Math.pow(2, z);
  const project: ProjectFunction = (position) => {
    const mercator = lngLatToMercator({ lng: position[0], lat: position[1] });
    return [mercator.x * n - x, mercator.y * n - y];
  };

  // Only parse the source-layers referenced by the style's layers
  for (const { id, sourceLayer } of layers) {
    const layer = tile.layers[sourceLayer];
    if (layer === undefined) continue;

    // Collect the whole layer into one FeatureCollection
    const features: Feature[] = [];
    for (let i = 0; i < layer.length; i++) {
      features.push(layer.feature(i).toGeoJSON(x, y, z));
    }
    const featureCollection: GeoJSON = {
      type: 'FeatureCollection',
      features,
    };

    for (const cmd of geoJSONToDrawCommands(featureCollection, project)) {
      commands.push({ ...cmd, layerId: id });
    }
  }

  return commands;
}
