import { multiply, scale, translation, type Mat3 } from './mat3';

const TILE_SIZE = 512;

export interface CameraOptions {
  center?: [number, number];
  zoom?: number;
  viewportWidth: number;
  viewportHeight: number;
}

export class Camera {
  private _center: [number, number];
  private _zoom: number;
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(options: CameraOptions) {
    this._center = options.center ? [...options.center] : [0.5, 0.5];
    this._zoom = options.zoom ?? 0;
    this.viewportHeight = options.viewportHeight;
    this.viewportWidth = options.viewportWidth;
  }

  get worldSize() {
    return TILE_SIZE * Math.pow(2, this._zoom);
  }

  get zoom(): number {
    return this._zoom;
  }

  get center(): [number, number] {
    return [...this._center];
  }

  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const [minX, minY] = this.worldPxToMercator(...this.screenToWorldPx(0, 0));
    const [maxX, maxY] = this.worldPxToMercator(
      ...this.screenToWorldPx(this.viewportWidth, this.viewportHeight),
    );

    return { minX, minY, maxX, maxY };
  }

  pan(dxPixels: number, dyPixels: number) {
    const [dxMercator, dyMercator] = this.worldPxToMercator(dxPixels, dyPixels);

    this._center[0] -= dxMercator;
    this._center[1] -= dyMercator;
  }

  zoomAt(canvasX: number, canvasY: number, factor: number) {
    const [anchorX, anchorY] = this.worldPxToMercator(
      ...this.screenToWorldPx(canvasX, canvasY),
    );

    this._zoom += Math.log2(factor);

    const [driftedX, driftedY] = this.worldPxToMercator(
      ...this.screenToWorldPx(canvasX, canvasY),
    );

    const offsetX = anchorX - driftedX;
    const offsetY = anchorY - driftedY;

    this._center[0] += offsetX;
    this._center[1] += offsetY;
  }

  // mercator -> world pixel -> screen -> clip space
  getMatrix(): Mat3 {
    const { viewportWidth: w, viewportHeight: h } = this;

    // mercator -> world pixel
    const worldPxFromMercator = scale(this.worldSize, this.worldSize);

    // world pixel -> screen
    const [centerPxX, centerPxY] = this.mercatorToWorldPx(...this._center);
    const screenFromWorldPx = translation(w / 2 - centerPxX, h / 2 - centerPxY);

    // screen -> clip space
    const clipFromScreen = multiply(
      scale(2 / w, -2 / h),
      translation(-w / 2, -h / 2),
    );

    return multiply(
      clipFromScreen,
      multiply(screenFromWorldPx, worldPxFromMercator),
    );
  }

  private mercatorToWorldPx(x: number, y: number): [number, number] {
    return [x * this.worldSize, y * this.worldSize];
  }

  private worldPxToMercator(x: number, y: number): [number, number] {
    return [x / this.worldSize, y / this.worldSize];
  }

  private screenToWorldPx(x: number, y: number): [number, number] {
    const { viewportWidth: w, viewportHeight: h } = this;

    const screenCenterX = w / 2;
    const screenCenterY = h / 2;

    const [centerPxX, centerPxY] = this.mercatorToWorldPx(...this._center);

    const worldX = x - screenCenterX + centerPxX;
    const worldY = y - screenCenterY + centerPxY;

    return [worldX, worldY];
  }
}
