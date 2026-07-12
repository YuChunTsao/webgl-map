import { multiply, scale, translation, type Mat3 } from './mat3';

export interface CameraOptions {
  center?: [number, number];
  zoom?: number;
  viewportWidth: number;
  viewportHeight: number;
}

export class Camera {
  private center: [number, number];
  private zoom: number;
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(options: CameraOptions) {
    this.center = options.center ? [...options.center] : [0, 0];
    this.zoom = options.zoom ?? 1;
    this.viewportHeight = options.viewportHeight;
    this.viewportWidth = options.viewportWidth;
  }

  pan(dxPixels: number, dyPixels: number) {
    this.center[0] -= (dxPixels * (2 / this.viewportWidth)) / this.zoom;
    this.center[1] += (dyPixels * (2 / this.viewportHeight)) / this.zoom;
  }

  zoomAt(clipX: number, clipY: number, factor: number) {
    const worldX = this.center[0] + clipX / this.zoom;
    const worldY = this.center[1] + clipY / this.zoom;

    this.zoom *= factor;

    this.center[0] = worldX - clipX / this.zoom;
    this.center[1] = worldY - clipY / this.zoom;
  }

  getMatrix(): Mat3 {
    const [cx, cy] = this.center;
    const z = this.zoom;
    const translationMatrix: Mat3 = translation(-cx, -cy);
    const scaleMatrix: Mat3 = scale(z, z);
    return multiply(scaleMatrix, translationMatrix);
  }
}
