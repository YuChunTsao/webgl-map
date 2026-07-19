import { Camera } from './Camera';
import type { GeoJSON } from 'geojson';
import { compileShader, createProgram } from './gl-utils';
import { fragmentShaderSource, vertexShaderSource } from './shaders';
import type {
  BackgroundLayer,
  CachedTile,
  Color,
  LngLat,
  Style,
  StyleLayer,
  TileDrawCommand,
  TileGPUCommand,
  TileStyleLayer,
  VectorTileSource,
} from './types';
import { geoJSONToDrawCommands } from './geometry-draw';
import { lngLatToMercator, mercatorToTile } from './mercator';
import { TileWorker } from './TileWorker';
import { identity, multiply, scale, translation, type Mat3 } from './mat3';

export interface WebGLMapOptions {
  containerId: string;
  center?: LngLat;
  zoom?: number;
  style: Style;
}

export class WebGLMap {
  private static readonly MAX_CACHED_TILES = 256;
  private containerId: string;
  private container!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private program!: WebGLProgram;
  private gl!: WebGL2RenderingContext;
  private positionAttribLocation!: number;
  private matrixUniformLocation!: WebGLUniformLocation;
  private colorUniformLocation!: WebGLUniformLocation;
  private isDragging: boolean = false;
  private camera!: Camera;
  private cachedTiles: Map<string, CachedTile> = new Map();
  private visibleTileKeys: Map<string, Set<string>> = new Map(); // sourceId -> tile keys
  private renderRequested: boolean = false;
  private tileWorker: TileWorker = new TileWorker();
  private style: Style;
  private backgroundVAO!: WebGLVertexArrayObject;

  constructor(options: WebGLMapOptions) {
    this.containerId = options.containerId;
    this.style = options.style;

    this.initCanvas();
    this.initGL();
    this.initProgram();
    this.initCamera(options.center, options.zoom);
    this.bindEvents();
    this.verifyStyle();
    this.initBackground();

    this.tileWorker.setLayers(
      this.style.layers
        .filter(this.isTileLayer)
        .map(({ id, source, sourceLayer }) => {
          return { id, source, sourceLayer };
        }),
    );

    this.updateVisibleTiles();

    this.requestRender();
  }

  private tileCacheKey(source: string, z: number, x: number, y: number) {
    return `${source}/${z}/${x}/${y}`;
  }

  private getTileMatrix(tile: CachedTile) {
    const { z, x, y } = tile;
    const n = Math.pow(2, z);
    return multiply(translation(x / n, y / n), scale(1 / n, 1 / n));
  }

  private verifyStyle() {
    const sourceNames = new Set(Object.keys(this.style.sources));
    for (const layer of this.style.layers) {
      if (!this.isTileLayer(layer)) continue;
      if (!sourceNames.has(layer.source)) {
        throw new Error(
          `layer "${layer.id}" references unknown source "${layer.source}"`,
        );
      }
    }
  }

  private isTileLayer(layer: StyleLayer): layer is TileStyleLayer {
    return layer.type !== 'background';
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

  private initBackground() {
    const topLeft = [-1, 1];
    const topRight = [1, 1];
    const bottomLeft = [-1, -1];
    const bottomRight = [1, -1];

    const positions = new Float32Array([
      ...topLeft,
      ...topRight,
      ...bottomRight,
      ...topLeft,
      ...bottomLeft,
      ...bottomRight,
    ]);

    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    this.backgroundVAO = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.backgroundVAO);
    this.gl.enableVertexAttribArray(this.positionAttribLocation);
    this.gl.vertexAttribPointer(
      this.positionAttribLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0,
    );
    this.gl.bindVertexArray(null);
  }

  private drawBackground(layer: BackgroundLayer) {
    this.gl.uniform4f(this.colorUniformLocation, ...layer.color);
    this.gl.uniformMatrix3fv(this.matrixUniformLocation, false, identity());
    this.gl.bindVertexArray(this.backgroundVAO);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  private drawTileLayer(layer: TileStyleLayer, cameraMatrix: Mat3) {
    this.gl.uniform4f(this.colorUniformLocation, ...layer.color);

    const keys = this.visibleTileKeys.get(layer.source);
    if (keys === undefined) return;
    for (const key of keys) {
      const tile = this.cachedTiles.get(key);
      if (tile === undefined) continue;

      const tileMatrix = this.getTileMatrix(tile);
      const matrix = multiply(cameraMatrix, tileMatrix);

      this.gl.uniformMatrix3fv(this.matrixUniformLocation, false, matrix);

      for (const cmd of tile.commands) {
        if (cmd.layerId !== layer.id) continue;
        this.gl.bindVertexArray(cmd.vao);
        this.gl.drawArrays(cmd.mode, 0, cmd.vertexCount);
      }
    }
  }

  render() {
    this.gl.useProgram(this.program);
    this.gl.clearColor(0.7, 0.7, 0.7, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const cameraMatrix = this.camera.getMatrix();

    for (const layer of this.style.layers) {
      switch (layer.type) {
        case 'background':
          this.drawBackground(layer);
          break;
        case 'circle':
        case 'line':
        case 'fill':
          this.drawTileLayer(layer, cameraMatrix);
          break;
        default:
          throw new Error(`unknown layer type`);
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
    new ResizeObserver(() => this.onResize()).observe(this.container);
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

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.camera.setViewportSize(w, h);
    this.updateVisibleTiles();
    this.render();
  }

  async loadTile(
    sourceId: string,
    source: VectorTileSource,
    z: number,
    x: number,
    y: number,
  ) {
    // If the tile has already been fetched, we don't fetch it again.
    const key = this.tileCacheKey(sourceId, z, x, y);
    if (this.tileWorker.isLoading(key) || this.cachedTiles.has(key)) return;

    const url = source.tiles[(x + y) % source.tiles.length];
    const tileUrl = url
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));

    try {
      const result = await this.tileWorker.loadTile(
        key,
        tileUrl,
        sourceId,
        z,
        x,
        y,
      );
      this.cachedTiles.set(key, { z, x, y, commands: this.uploadTile(result) });
      this.evictTiles();
      this.requestRender();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn(`Failed to load tile ${key}:`, error);
    }
  }

  private uploadTile(commands: TileDrawCommand[]): TileGPUCommand[] {
    const gpuCommands = commands.map(({ layerId, positions, mode }) => {
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

      return { layerId, vao, buffer, mode, vertexCount: positions.length / 2 };
    });

    // Unbind so later GL calls can't accidentally modify the last VAO.
    this.gl.bindVertexArray(null);
    return gpuCommands;
  }

  private destroyTile(commands: TileGPUCommand[]) {
    for (const { vao, buffer } of commands) {
      this.gl.deleteVertexArray(vao);
      this.gl.deleteBuffer(buffer);
    }
  }

  updateVisibleTiles() {
    const { minX, minY, maxX, maxY } = this.camera.getBounds();

    // Get all used sources from layers defined by users.
    const usedSource = new Set(
      this.style.layers.filter(this.isTileLayer).map((layer) => layer.source),
    );

    for (const sourceId of usedSource) {
      const visibleTileKeys: Set<string> = new Set();

      const source = this.style.sources[sourceId];
      const sourceZoom = Math.min(
        Math.floor(this.camera.zoom),
        Math.floor(source.maxzoom ?? 14),
      );

      const { x: minTileX, y: minTileY } = mercatorToTile(
        minX,
        minY,
        sourceZoom,
      );
      const { x: maxTileX, y: maxTileY } = mercatorToTile(
        maxX,
        maxY,
        sourceZoom,
      );

      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          this.loadTile(sourceId, source, sourceZoom, x, y);
          const key = this.tileCacheKey(sourceId, sourceZoom, x, y);
          visibleTileKeys.add(key);
          this.touchTile(key);
        }
      }

      this.visibleTileKeys.set(sourceId, visibleTileKeys);
    }

    // Abort in-flight requests for tiles that are no longer visible.
    for (const key of this.tileWorker.loadingKeys()) {
      if (!this.isTileVisible(key)) this.tileWorker.abort(key);
    }
  }

  private isTileVisible(key: string): boolean {
    for (const keys of this.visibleTileKeys.values()) {
      if (keys.has(key)) return true;
    }

    return false;
  }

  private touchTile(key: string) {
    const commands = this.cachedTiles.get(key);
    if (commands === undefined) return;
    this.cachedTiles.delete(key);
    this.cachedTiles.set(key, commands);
  }

  private evictTiles() {
    for (const key of this.cachedTiles.keys()) {
      if (this.cachedTiles.size <= WebGLMap.MAX_CACHED_TILES) break;
      if (this.isTileVisible(key)) continue;

      // GPU memory must be freed explicitly.
      this.destroyTile(this.cachedTiles.get(key)!.commands);
      this.cachedTiles.delete(key);
    }
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
    this.gl.uniformMatrix3fv(
      this.matrixUniformLocation,
      false,
      this.camera.getMatrix(),
    );

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
