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
  color: Color;
}

export interface TileGPUCommand {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  mode: GLenum;
  vertexCount: number;
  color: Color;
}
