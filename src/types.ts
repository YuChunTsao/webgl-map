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

export interface StyleLayer {
  id: string;
  source: string;
  sourceLayer: string;
  color: Color;
}

export type ParseLayer = Pick<StyleLayer, 'id' | 'source' | 'sourceLayer'>;

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
