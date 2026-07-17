import { VectorTile } from '@mapbox/vector-tile';
import type { Color, TileDrawCommand } from './types';
import { PbfReader } from 'pbf';
import type { GeoJSON, Feature } from 'geojson';
import { geoJSONToDrawCommands } from './geometry-draw';

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
): TileDrawCommand[] {
  const tile = new VectorTile(new PbfReader(data));

  // TODO: Allow users to customize layer colors.
  const layerConfigs: Record<string, Color> = {
    water: [0.4, 0.6, 0.9, 1.0],
    landcover: [0.6, 0.8, 0.5, 1.0],
    boundary: [0.2, 0.2, 0.2, 1.0],
    place: [0.9, 0.3, 0.1, 1.0],
    water_name: [0.1, 0.3, 0.6, 1.0],
  };

  // Collect all data in the tile
  const tileDrawCommands: TileDrawCommand[] = [];
  for (const [layerName, layer] of Object.entries(tile.layers)) {
    if (layerConfigs[layerName] === undefined) continue;
    const color = layerConfigs[layerName];

    // Collect the whole layer into one FeatureCollection
    const features: Feature[] = [];
    for (let i = 0; i < layer.length; i++) {
      features.push(layer.feature(i).toGeoJSON(x, y, z));
    }

    const featureCollection: GeoJSON = {
      type: 'FeatureCollection',
      features,
    };
    for (const cmd of geoJSONToDrawCommands(featureCollection)) {
      tileDrawCommands.push({ ...cmd, color });
    }
  }

  return tileDrawCommands;
}
