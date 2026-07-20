export interface LngLat {
  lng: number;
  lat: number;
}

export type Color = [r: number, g: number, b: number, a: number];

export interface DrawCommand {
  positions: Float32Array;
  mode: GLenum;
}

export interface TileDrawCommand extends DrawCommand {
  layerId: string;
}

export interface TileGPUCommand {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  mode: GLenum;
  vertexCount: number;
  layerId: string;
}

export interface CachedTile {
  z: number;
  x: number;
  y: number;
  commands: TileGPUCommand[];
}

interface LayerBase {
  id: string;
}

export interface BackgroundLayer extends LayerBase {
  type: 'background';
  color: Color;
}

export interface FillLayer extends LayerBase {
  type: 'fill';
  source: string;
  sourceLayer: string;
  color: Color;
}

export interface CircleLayer extends LayerBase {
  type: 'circle';
  source: string;
  sourceLayer: string;
  color: Color;
  size?: number;
}

export interface LineLayer extends LayerBase {
  type: 'line';
  source: string;
  sourceLayer: string;
  color: Color;
}

export type StyleLayer = BackgroundLayer | FillLayer | CircleLayer | LineLayer;

export type TileStyleLayer = Exclude<StyleLayer, BackgroundLayer>;

export type ParseLayer = Pick<
  TileStyleLayer,
  'id' | 'source' | 'sourceLayer' | 'type'
>;

export type VectorTileSource = {
  type: 'vector';
  tiles: string[];
  maxzoom?: number;
};

export type Source = VectorTileSource;

export interface Style {
  sources: Record<string, Source>;
  layers: StyleLayer[];
}
