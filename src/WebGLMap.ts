import { Camera } from './Camera';
import type { GeoJSON } from 'geojson';
import { compileShader, createProgram } from './gl-utils';
import { fragmentShaderSource, vertexShaderSource } from './shaders';
import type { Color, LngLat } from './types';
import { geoJSONToDrawCommands, type DrawCommand } from './geometry-draw';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { lngLatToMercator, mercatorToTile } from './mercator';

interface TileDrawCommand extends DrawCommand {
  color: Color;
}

export interface WebGLMapOptions {
  containerId: string;
  center?: LngLat;
  zoom?: number;
}

export class WebGLMap {
  private containerId: string;
  private container?: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private program!: WebGLProgram;
  private gl!: WebGL2RenderingContext;
  private positionAttribLocation!: number;
  private matrixUniformLocation!: WebGLUniformLocation;
  private colorUniformLocation!: WebGLUniformLocation;
  private isDragging: boolean = false;
  private camera!: Camera;
  private cachedTiles: Map<string, TileDrawCommand[]> = new Map();
  private tileRequests: Map<string, Promise<TileDrawCommand[]>> = new Map();
  private visibleTileKeys: Set<string> = new Set();
  private vectorTileUrl: string;
  private renderRequested: boolean = false;

  constructor(options: WebGLMapOptions) {
    this.containerId = options.containerId;

    this.initCanvas();
    this.initGL();
    this.initProgram();
    this.initCamera(options.center, options.zoom);
    this.bindEvents();

    this.vectorTileUrl =
      'https://tiles.openstreetmap.us/vector/openmaptiles/{z}/{x}/{y}.mvt';
    this.updateVisibleTiles();

    this.requestRender();
  }

  private tileCacheKey(z: number, x: number, y: number) {
    return `${z}/${x}/${y}`;
  }

  // Avoid rendering more than once per frame
  requestRender() {
    if (this.renderRequested) return;
    this.renderRequested = true;

    requestAnimationFrame(() => {
      this.renderRequested = false;
      this.render();
    });
  }

  render() {
    this.gl.useProgram(this.program);
    this.gl.clearColor(0.7, 0.7, 0.7, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.uniformMatrix3fv(
      this.matrixUniformLocation,
      false,
      this.camera.getMatrix(),
    );

    for (const key of this.visibleTileKeys) {
      const cacheTile = this.cachedTiles.get(key);
      if (cacheTile === undefined) continue;
      for (const cmd of cacheTile) {
        this.drawGeometry(cmd.positions, cmd.mode, cmd.color);
      }
    }
  }

  initCamera(center?: LngLat, zoom?: number) {
    const mercatorCenter = center ? lngLatToMercator(center) : undefined;

    this.camera = new Camera({
      center: mercatorCenter && [mercatorCenter.x, mercatorCenter.y],
      zoom: zoom,
      viewportWidth: this.canvas.width,
      viewportHeight: this.canvas.height,
    });
  }

  bindEvents() {
    this.bindMouseDownEvent();
    this.bindMouseUpEvent();
    this.bindMouseMoveEvent();
    this.bindMouseWheelEvent();
  }

  bindMouseWheelEvent() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;

      this.camera.zoomAt(canvasX, canvasY, factor);

      this.updateVisibleTiles();
      this.requestRender();
    });
  }

  bindMouseMoveEvent() {
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.camera.pan(e.movementX, e.movementY);
      this.updateVisibleTiles();
      this.requestRender();
    });
  }

  bindMouseDownEvent() {
    this.canvas.addEventListener('mousedown', () => {
      this.isDragging = true;
      this.canvas.style.cursor = 'grabbing';
    });
  }

  bindMouseUpEvent() {
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });
  }

  loadTile(url: string, z: number, x: number, y: number) {
    // If the tile has already been fetched, we don't fetch it again.
    const key = this.tileCacheKey(z, x, y);
    if (this.tileRequests.has(key)) return;

    const request = this.parseTile(url, z, x, y);
    this.tileRequests.set(key, request);

    request
      .then((commands) => {
        this.cachedTiles.set(key, commands);
        this.requestRender();
      })
      .catch(() => {
        this.tileRequests.delete(key);
      });
  }

  private async parseTile(
    url: string,
    z: number,
    x: number,
    y: number,
  ): Promise<TileDrawCommand[]> {
    const tileUrl = url
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
    const tile = await this.fetchTile(tileUrl);

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
      for (let i = 0; i < layer.length; i++) {
        const geojson = layer.feature(i).toGeoJSON(x, y, z);
        for (const cmd of geoJSONToDrawCommands(geojson)) {
          tileDrawCommands.push({ ...cmd, color });
        }
      }
    }

    return tileDrawCommands;
  }

  async fetchTile(url: string): Promise<VectorTile> {
    const response = await fetch(url);
    const data = await response.arrayBuffer();

    return new VectorTile(new PbfReader(new Uint8Array(data)));
  }

  updateVisibleTiles() {
    const { minX, minY, maxX, maxY } = this.camera.getBounds();
    const z = Math.floor(this.camera.zoom);

    const { x: minTileX, y: minTileY } = mercatorToTile(minX, minY, z);
    const { x: maxTileX, y: maxTileY } = mercatorToTile(maxX, maxY, z);

    const tiles = [];

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        tiles.push({ z, x, y });
      }
    }

    const visibleTileKeys: Set<string> = new Set();
    for (const { z, x, y } of tiles) {
      this.loadTile(this.vectorTileUrl, z, x, y);
      visibleTileKeys.add(this.tileCacheKey(z, x, y));
    }

    this.visibleTileKeys = visibleTileKeys;
  }

  drawGeoJSON(geojson: GeoJSON, color: Color) {
    for (const cmd of geoJSONToDrawCommands(geojson)) {
      this.drawGeometry(cmd.positions, cmd.mode, color);
    }
  }

  drawGeometry(positions: Float32Array, mode: GLenum, color: Color) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    const vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(vao);
    this.gl.enableVertexAttribArray(this.positionAttribLocation);
    this.gl.vertexAttribPointer(
      this.positionAttribLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0,
    );

    this.gl.uniform4f(this.colorUniformLocation, ...color);

    const vertexCount = positions.length / 2;
    this.gl.drawArrays(mode, 0, vertexCount);

    this.gl.deleteBuffer(buffer);
    this.gl.deleteVertexArray(vao);
  }

  initProgram() {
    const vertexShader = compileShader(
      this.gl,
      this.gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = compileShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    this.program = createProgram(this.gl, vertexShader, fragmentShader);

    const positionAttribLocation = this.gl.getAttribLocation(
      this.program,
      'a_position',
    );
    if (positionAttribLocation === -1)
      throw new Error(
        `WebGLMap: failed to find attribute location for "a_position"`,
      );

    this.positionAttribLocation = positionAttribLocation;

    const matrixUniformLocation = this.gl.getUniformLocation(
      this.program,
      'u_matrix',
    );
    if (matrixUniformLocation === null) {
      throw new Error(
        `WebGLMap: failed to find uniform location for "u_matrix"`,
      );
    }
    this.matrixUniformLocation = matrixUniformLocation;

    const colorUniformLocation = this.gl.getUniformLocation(
      this.program,
      'u_color',
    );
    if (colorUniformLocation === null) {
      throw new Error(
        `WebGLMap: failed to find uniform location for "u_color"`,
      );
    }
    this.colorUniformLocation = colorUniformLocation;

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
  }

  initGL() {
    const context = this.canvas.getContext('webgl2');
    if (!(context instanceof WebGL2RenderingContext)) {
      throw new Error(
        `WebGLMap: context element not found or is not a WebGL2RenderingContext`,
      );
    }

    this.gl = context;
  }

  initCanvas() {
    const element = document.getElementById(this.containerId);
    if (!(element instanceof HTMLDivElement)) {
      throw new Error(
        `WebGLMap: container element "#${this.containerId}" not found or is not a <div>.`,
      );
    }
    this.container = element;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'grab';
    this.container.appendChild(this.canvas);
  }
}
