export type Position = [number, number];
export type Ring = Position[];

export interface Point {
  type: 'Point';
  coordinates: Position;
}

export interface MultiPoint {
  type: 'MultiPoint';
  coordinates: Position[];
}

export interface LineString {
  type: 'LineString';
  coordinates: Position[];
}

export interface MultiLineString {
  type: 'MultiLineString';
  coordinates: Position[][];
}

export interface Polygon {
  type: 'Polygon';
  coordinates: Ring[];
}

export interface MultiPolygon {
  type: 'MultiPolygon';
  coordinates: Ring[][];
}

export interface GeometryCollection {
  type: 'GeometryCollection';
  geometries: Geometry[];
}

export type Geometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon
  | GeometryCollection;

export interface Feature {
  type: 'Feature';
  geometry: Geometry;
  properties: Record<string, unknown> | null;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

export type GeoJSON = FeatureCollection | Feature | Geometry;
