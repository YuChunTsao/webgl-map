import { WebGLMap } from '../src/index.ts';
import { LngLat } from '../src/types.ts';

const center: LngLat = { lng: 121.517, lat: 25.047 };

new WebGLMap({
  containerId: 'map',
  center: center,
  zoom: 14,
});
