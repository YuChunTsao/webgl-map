import earcut, { flatten } from 'earcut';
import { lngLatToMercator } from './mercator';
import type { DrawCommand, LngLat } from './types';
import type { GeoJSON, Geometry, Position } from 'geojson';

export type ProjectFunction = (position: Position) => [number, number];

function projectPosition(position: Position): [number, number] {
  const { x, y } = lngLatToMercator(positionToLngLat(position));
  return [x, y];
}

export function geoJSONToDrawCommands(
  geojson: GeoJSON,
  project: ProjectFunction = projectPosition,
): DrawCommand[] {
  const commands = flattenToGeometries(geojson).flatMap((geometry) =>
    geometryToDrawCommand(geometry, project),
  );

  // Merge commands that share a draw mode, so each mode can be drawn in a single draw call.
  return mergeDrawCommands(commands);
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

function geometryToDrawCommand(
  geometry: Geometry,
  project: ProjectFunction,
): DrawCommand[] {
  switch (geometry.type) {
    case 'Point':
      return [
        {
          positions: pointToVertices([geometry.coordinates], project),
          mode: WebGL2RenderingContext.POINTS,
        },
      ];
    case 'MultiPoint':
      return [
        {
          positions: pointToVertices(geometry.coordinates, project),
          mode: WebGL2RenderingContext.POINTS,
        },
      ];
    case 'LineString':
      return [
        {
          positions: lineToVertices(geometry.coordinates, project),
          mode: WebGL2RenderingContext.LINES,
        },
      ];
    case 'MultiLineString':
      return geometry.coordinates.map((line) => {
        return {
          positions: lineToVertices(line, project),
          mode: WebGL2RenderingContext.LINES,
        };
      });
    case 'Polygon':
      return [
        {
          positions: polygonToVertices(geometry.coordinates, project),
          mode: WebGL2RenderingContext.TRIANGLES,
        },
      ];
    case 'MultiPolygon':
      return geometry.coordinates.map((polygon) => {
        return {
          positions: polygonToVertices(polygon, project),
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

function pointToVertices(
  coordinates: Position[],
  project: ProjectFunction,
): Float32Array {
  const data: number[] = [];
  for (const coordinate of coordinates) {
    const [x, y] = project(coordinate);
    data.push(x, y);
  }

  return new Float32Array(data);
}

function lineToVertices(
  coordinates: Position[],
  project: ProjectFunction,
): Float32Array {
  const data: number[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const fromCoord = coordinates[i];
    const toCoord = coordinates[i + 1];
    const [fromX, fromY] = project(fromCoord);
    const [toX, toY] = project(toCoord);
    data.push(fromX, fromY, toX, toY);
  }

  return new Float32Array(data);
}

function polygonToVertices(
  rings: Position[][],
  project: ProjectFunction,
): Float32Array {
  const projectedRings: Position[][] = rings.map((ring) => {
    return ring.map((position) => {
      return project(position);
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

function mergeDrawCommands(commands: DrawCommand[]): DrawCommand[] {
  // Group vertex arrays by draw mode.
  const groups = new Map<GLenum, Float32Array[]>();
  for (const { mode, positions } of commands) {
    if (positions.length === 0) continue;
    const group = groups.get(mode);
    if (group === undefined) groups.set(mode, [positions]);
    else group.push(positions);
  }

  // Concatenate each group into a single vertex array.
  return [...groups].map(([mode, arrays]) => {
    let totalLength = 0;
    for (const arr of arrays) totalLength += arr.length;

    const positions = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      positions.set(arr, offset);
      offset += arr.length;
    }

    return { mode, positions };
  });
}
