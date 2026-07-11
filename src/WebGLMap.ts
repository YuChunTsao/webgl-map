import { compileShader, createProgram } from './gl-utils';
import { fragmentShaderSource, vertexShaderSource } from './shaders';

export interface WebGLMapOptions {
  containerId: string;
  center?: [number, number];
}

export class WebGLMap {
  private containerId: string;
  private container?: HTMLDivElement;
  private center: [number, number];
  private canvas!: HTMLCanvasElement;
  private program!: WebGLProgram;
  private gl!: WebGL2RenderingContext;
  private positionAttribLocation!: number;
  private isDragging: boolean = false;

  constructor(options: WebGLMapOptions) {
    this.containerId = options.containerId;
    this.center = options.center ?? [0, 0];

    this.initCanvas();
    this.initGL();
    this.initProgram();
    this.bindEvents();

    this.render();
  }

  render() {
    this.gl.useProgram(this.program);
    this.gl.clearColor(0.7, 0.7, 0.7, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const [cx, cy] = this.center;
    const positions = new Float32Array([
      0 - cx,
      0.5 - cy,
      -0.5 - cx,
      0 - cy,
      0.5 - cx,
      0 - cy,
    ]);
    this.drawTriangle(positions);
  }

  bindEvents() {
    this.bindMouseDownEvent();
    this.bindMouseUpEvent();
    this.bindMouseMoveEvent();
  }

  bindMouseMoveEvent() {
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      this.center[0] -= e.movementX * (2 / this.canvas.width);
      this.center[1] += e.movementY * (2 / this.canvas.height);

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

  drawTriangle(positions: Float32Array) {
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

    const vertexCount = positions.length / 2;
    this.gl.drawArrays(this.gl.TRIANGLES, 0, vertexCount);

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

    this.positionAttribLocation = this.gl.getAttribLocation(
      this.program,
      'a_position',
    );
    if (this.positionAttribLocation === -1)
      throw new Error(
        `WebGLMap: failed to find attribute location for "a_position"`,
      );

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
