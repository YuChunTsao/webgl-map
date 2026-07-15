import earcut, { flatten } from 'earcut';
import type { GeoJSON, Geometry, Position, Ring } from './geojson';
import { lngLatToMercator } from './mercator';
import type { LngLat } from './types';

export interface DrawCommand {
  positions: Float32Array;
  mode: GLenum;
}

export function geoJSONToDrawCommands(geojson: GeoJSON): DrawCommand[] {
  return flattenToGeometries(geojson).flatMap(geometryToDrawCommand);
}

function flattenToGeometries(geojson: GeoJSON): Geometry[] {
  switch (geojson.type) {
    case 'Feature':
      return flattenToGeometries(geojson.geometry);
    case 'FeatureCollection':
      return geojson.features.flatMap((f) => flattenToGeometries(f.geometry));
    case 'GeometryCollection':
      return geojson.geometries.flatMap((g) => flattenToGeometries(g));
    default:
      return [geojson];
  }
}

function geometryToDrawCommand(geometry: Geometry): DrawCommand[] {
  switch (geometry.type) {
    case 'Point':
      return [
        {
          positions: pointToVertices([geometry.coordinates]),
          mode: WebGL2RenderingContext.POINTS,
        },
      ];
    case 'MultiPoint':
      return [
        {
          positions: pointToVertices(geometry.coordinates),
          mode: WebGL2RenderingContext.POINTS,
        },
      ];
    case 'LineString':
      return [
        {
          positions: lineToVertices(geometry.coordinates),
          mode: WebGL2RenderingContext.LINES,
        },
      ];
    case 'MultiLineString':
      return geometry.coordinates.map((line) => {
        return {
          positions: lineToVertices(line),
          mode: WebGL2RenderingContext.LINES,
        };
      });
    case 'Polygon':
      return [
        {
          positions: polygonToVertices(geometry.coordinates),
          mode: WebGL2RenderingContext.TRIANGLES,
        },
      ];
    case 'MultiPolygon':
      return geometry.coordinates.map((polygon) => {
        return {
          positions: polygonToVertices(polygon),
          mode: WebGL2RenderingContext.TRIANGLES,
        };
      });
    default:
      throw new Error(
        `Unexpected geometry type after flattening: ${geometry.type}`,
      );
  }
}

function positionToLngLat(position: Position): LngLat {
  return { lng: position[0], lat: position[1] };
}

function pointToVertices(coordinates: Position[]): Float32Array {
  const data: number[] = [];
  for (const coordinate of coordinates) {
    const { x, y } = lngLatToMercator(positionToLngLat(coordinate));
    data.push(x, y);
  }

  return new Float32Array(data);
}

function lineToVertices(coordinates: Position[]): Float32Array {
  const data: number[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const fromCoord = coordinates[i];
    const toCoord = coordinates[i + 1];
    const { x: fromX, y: fromY } = lngLatToMercator(
      positionToLngLat(fromCoord),
    );
    const { x: toX, y: toY } = lngLatToMercator(positionToLngLat(toCoord));
    data.push(fromX, fromY, toX, toY);
  }

  return new Float32Array(data);
}

function polygonToVertices(rings: Ring[]): Float32Array {
  const projectedRings: Ring[] = rings.map((ring) => {
    return ring.map((position) => {
      const { x, y } = lngLatToMercator(positionToLngLat(position));
      return [x, y];
    });
  });

  const { vertices, holes, dimensions } = flatten(projectedRings);
  const indices = earcut(vertices, holes, dimensions);

  const triangleVertices: number[] = [];
  for (const idx of indices) {
    triangleVertices.push(
      vertices[idx * dimensions],
      vertices[idx * dimensions + 1],
    );
  }

  return new Float32Array(triangleVertices);
}
