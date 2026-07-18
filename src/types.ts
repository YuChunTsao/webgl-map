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

export interface StyleLayer {
  id: string;
  sourceLayer: string;
  color: Color;
}

export type ParseLayer = Pick<StyleLayer, 'id' | 'sourceLayer'>;

export interface Style {
  layers: StyleLayer[];
}
