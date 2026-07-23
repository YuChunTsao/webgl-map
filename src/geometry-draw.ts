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
      const { positions, extrude } = lineToExtrudedVertices(
        geometry.coordinates,
        project,
      );
      return [
        {
          positions,
          extrude,
          mode: WebGL2RenderingContext.TRIANGLES,
        },
      ];
    case 'MultiLineString':
      return geometry.coordinates.map((line) => {
        const { positions, extrude } = lineToExtrudedVertices(line, project);
        return {
          positions,
          extrude,
          mode: WebGL2RenderingContext.TRIANGLES,
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

// Extrude line
// from+n --------- to+n
//       |       / |
//       |     /   |
//       |   /     |
//       | /       |
// from-n -------- to-n
//
// triangle vertices: [from+n, from-n, to+n, from-n, to-n, to+n]
function lineToExtrudedVertices(
  coordinates: Position[],
  project: ProjectFunction,
): { positions: Float32Array; extrude: Float32Array } {
  const positions: number[] = [];
  const extrude: number[] = [];

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [fromX, fromY] = project(coordinates[i]);
    const [toX, toY] = project(coordinates[i + 1]);

    // normal
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    const nx = -dy / len;
    const ny = dx / len;

    // push 6 vertcies
    positions.push(
      fromX,
      fromY,
      fromX,
      fromY,
      toX,
      toY,
      fromX,
      fromY,
      toX,
      toY,
      toX,
      toY,
    );

    extrude.push(nx, ny, -nx, -ny, nx, ny, -nx, -ny, -nx, -ny, nx, ny);
  }

  return {
    positions: new Float32Array(positions),
    extrude: new Float32Array(extrude),
  };
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

function groupKey(cmd: DrawCommand): string {
  return `${cmd.mode}:${cmd.extrude ? 'extrude' : 'plain'}`;
}

function mergeDrawCommands(commands: DrawCommand[]): DrawCommand[] {
  // Group vertex arrays by draw mode.
  const groups = new Map<string, DrawCommand[]>();
  for (const cmd of commands) {
    if (cmd.positions.length === 0) continue;
    const key = groupKey(cmd);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [cmd]);
    else group.push(cmd);
  }

  // Concatenate each group into a single vertex array.
  return [...groups.values()].map((commands) => {
    // positions
    let totalPositionsLength = 0;
    for (const cmd of commands) totalPositionsLength += cmd.positions.length;

    const positions = new Float32Array(totalPositionsLength);
    let positionOffset = 0;
    for (const cmd of commands) {
      positions.set(cmd.positions, positionOffset);
      positionOffset += cmd.positions.length;
    }

    // extrude
    let totalExtrudeLength = 0;
    for (const cmd of commands) {
      if (cmd.extrude === undefined) continue;
      totalExtrudeLength += cmd.extrude.length;
    }

    const extrude = new Float32Array(totalExtrudeLength);
    let extrudeOffset = 0;
    for (const cmd of commands) {
      if (cmd.extrude === undefined) continue;
      extrude.set(cmd.extrude, extrudeOffset);
      extrudeOffset += cmd.extrude.length;
    }

    return {
      mode: commands[0].mode,
      positions,
      extrude: totalExtrudeLength > 0 ? extrude : undefined,
    };
  });
}
