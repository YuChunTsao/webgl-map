import { Camera } from './Camera';
import type {
  GeoJSON,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';
import { compileShader, createProgram } from './gl-utils';
import { fragmentShaderSource, vertexShaderSource } from './shaders';
import type { Color } from './types';
import { geoJSONToDrawCommands } from './geometry-draw';

export interface WebGLMapOptions {
  containerId: string;
  center?: [number, number];
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

  constructor(options: WebGLMapOptions) {
    this.containerId = options.containerId;

    this.initCanvas();
    this.initGL();
    this.initProgram();
    this.initCamera(options.center, options.zoom);
    this.bindEvents();

    this.render();
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

    const WEB_MERCATOR_LAT_LIMIT = 85.05112878;

    const worldBoundsPolygons: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-180, WEB_MERCATOR_LAT_LIMIT],
          [180, WEB_MERCATOR_LAT_LIMIT],
          [180, -WEB_MERCATOR_LAT_LIMIT],
          [-180, -WEB_MERCATOR_LAT_LIMIT],
          [-180, WEB_MERCATOR_LAT_LIMIT],
        ],
      ],
    };

    this.drawGeoJSON(worldBoundsPolygons, [1.0, 1.0, 1.0, 1.0]);

    const points: MultiPoint = {
      type: 'MultiPoint',
      coordinates: [
        [121.5654, 25.033], // Taipei
        [-74.006, 40.7128], // New York
        [-0.1276, 51.5074], // London
        [139.6917, 35.6895], // Tokyo
        [151.2093, -33.8688], // Sydney
        [37.6173, 55.7558], // Moscow
        [-43.1729, -22.9068], // Rio de Janeiro
      ],
    };
    this.drawGeoJSON(points, [1.0, 0.1, 0.0, 1.0]);

    const point: Point = {
      type: 'Point',
      coordinates: [2.3522, 48.8566], // Paris
    };
    this.drawGeoJSON(point, [0.0, 0.5, 1.0, 1.0]);

    const lines: LineString = {
      type: 'LineString',
      coordinates: [
        [121.5654, 25.033], // Taipei
        [-74.006, 40.7128], // New York
        [121.5654, 25.033], // Taipei
        [139.6917, 35.6895], // Tokyo
      ],
    };
    this.drawGeoJSON(lines, [0.0, 1.0, 0.0, 1.0]);

    const multiLine: MultiLineString = {
      type: 'MultiLineString',
      coordinates: [
        [
          [121.5654, 25.033], // Taipei
          [151.2093, -33.8688], // Sydney
        ],
        [
          [-0.1276, 51.5074], // London
          [37.6173, 55.7558], // Moscow
        ],
      ],
    };
    this.drawGeoJSON(multiLine, [0.0, 0.0, 1.0, 1.0]);

    const multiPolygon: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [100, 10],
            [110, 10],
            [110, 20],
            [100, 20],
            [100, 10],
          ],
        ],
        [
          [
            [-60, -10],
            [-50, -10],
            [-50, 0],
            [-60, 0],
            [-60, -10],
          ],
        ],
      ],
    };
    this.drawGeoJSON(multiPolygon, [0.5, 0.0, 1.0, 1.0]);

    const polygonWithHole: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-10, 40],
          [0, 40],
          [0, 50],
          [-10, 50],
          [-10, 40],
        ],
        [
          [-7, 43],
          [-7, 47],
          [-3, 47],
          [-3, 43],
          [-7, 43],
        ],
      ],
    };
    this.drawGeoJSON(polygonWithHole, [0.0, 1.0, 1.0, 1.0]);
  }

  initCamera(center?: [number, number], zoom?: number) {
    this.camera = new Camera({
      center: center,
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

      this.render();
    });
  }

  bindMouseMoveEvent() {
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.camera.pan(e.movementX, e.movementY);
      this.render();
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
