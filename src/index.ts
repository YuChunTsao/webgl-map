export interface WebGLMapOptions {
  containerId: string;
}

export class WebGLMap {
  private containerId: string;

  constructor(options: WebGLMapOptions) {
    this.containerId = options.containerId;

    const container = document.getElementById(this.containerId);
    container!.innerText = 'Hello, WebGLMap';
  }
}
