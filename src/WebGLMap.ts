import { Camera } from './Camera';
import { compileShader, createProgram } from './gl-utils';
import { lngLatToMercator } from './mercator';
import { fragmentShaderSource, vertexShaderSource } from './shaders';
import type { Color, LngLat } from './types';

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

    const worldBoundsPolygons: LngLat[][] = [
      [
        { lng: -180, lat: WEB_MERCATOR_LAT_LIMIT },
        { lng: 180, lat: WEB_MERCATOR_LAT_LIMIT },
        { lng: 180, lat: -WEB_MERCATOR_LAT_LIMIT },
      ],
      [
        { lng: -180, lat: WEB_MERCATOR_LAT_LIMIT },
        { lng: -180, lat: -WEB_MERCATOR_LAT_LIMIT },
        { lng: 180, lat: -WEB_MERCATOR_LAT_LIMIT },
      ],
    ];

    this.drawTriangles(worldBoundsPolygons, [1.0, 1.0, 1.0, 1.0]);

    const points: LngLat[] = [
      { lng: 121.5654, lat: 25.033 }, // Taipei
      { lng: -74.006, lat: 40.7128 }, // New York
      { lng: -0.1276, lat: 51.5074 }, // London
      { lng: 139.6917, lat: 35.6895 }, // Tokyo
      { lng: 151.2093, lat: -33.8688 }, // Sydney
      { lng: 37.6173, lat: 55.7558 }, // Moscow
      { lng: -43.1729, lat: -22.9068 }, // Rio de Janeiro
    ];
    this.drawPoints(points, [1.0, 0.7, 0.5, 1.0]);

    const lines: [LngLat, LngLat][] = [
      [
        { lng: 121.5654, lat: 25.033 }, // Taipei
        { lng: -74.006, lat: 40.7128 }, // New York
      ],
      [
        { lng: 121.5654, lat: 25.033 }, // Taipei
        { lng: 139.6917, lat: 35.6895 }, // Tokyo
      ],
    ];
    this.drawLines(lines, [1.0, 0.0, 0.0, 1.0]);
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

  drawPoints(points: LngLat[], color: Color) {
    const data: number[] = [];
    for (const point of points) {
      const { x, y } = lngLatToMercator(point);
      data.push(x, y);
    }

    const positions = new Float32Array(data);
    this.drawGeometry(positions, this.gl.POINTS, color);
  }

  drawLines(lines: [LngLat, LngLat][], color: Color) {
    const data: number[] = [];
    for (const line of lines) {
      const { x: fromX, y: fromY } = lngLatToMercator(line[0]);
      const { x: toX, y: toY } = lngLatToMercator(line[1]);
      data.push(fromX, fromY, toX, toY);
    }

    const positions = new Float32Array(data);
    this.drawGeometry(positions, this.gl.LINES, color);
  }

  drawTriangles(triangles: LngLat[][], color: Color) {
    const data: number[] = [];
    for (const triangle of triangles) {
      for (const vertex of triangle) {
        const { x, y } = lngLatToMercator(vertex);
        data.push(x, y);
      }
    }

    const positions = new Float32Array(data);
    this.drawGeometry(positions, this.gl.TRIANGLES, color);
  }

  drawBounds(bounds: LngLat[], color: Color) {
    const data: number[] = [];
    for (const lnglat of bounds) {
      const { x, y } = lngLatToMercator(lnglat);
      data.push(x, y);
    }

    const positions = new Float32Array(data);
    this.drawGeometry(positions, this.gl.LINE_LOOP, color);
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
