import type { LngLat } from './types';

// 360 degree = 2 x PI
// 1 degree = PI / 180
// 1 radian = 180 / PI
function rad2deg(radian: number): number {
  return radian * (180 / Math.PI);
}

function deg2rad(degree: number): number {
  return degree * (Math.PI / 180);
}

// Web Mercator (normalized to 0~1):
//   x = (λ + π) / 2π                          λ = longitude (radians)
//   y = 1/2 - ln(tan(π/4 + φ/2)) / 2π         φ = latitude (radians)
export function lngLatToMercator(lngLat: LngLat): { x: number; y: number } {
  const { lng, lat } = lngLat;

  const x = (lng + 180) / 360;

  const latRad = deg2rad(lat);
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI);

  return {
    x,
    y,
  };
}

export function mercatorToLngLat(x: number, y: number): LngLat {
  const lng = x * 360 - 180;

  const exponent = Math.PI - 2 * Math.PI * y;
  const latRad = 2 * Math.atan(Math.exp(exponent)) - Math.PI / 2;
  const lat = rad2deg(latRad);

  return { lng, lat };
}
