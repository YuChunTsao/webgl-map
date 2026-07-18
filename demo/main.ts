import { WebGLMap } from '../src/index.ts';
import { LngLat } from '../src/types.ts';

const center: LngLat = { lng: 121.517, lat: 25.047 };

new WebGLMap({
  containerId: 'map',
  center: center,
  zoom: 14,
  style: {
    layers: [
      {
        id: 'building',
        sourceLayer: 'building',
        color: [0.6, 0.6, 0.6, 1.0],
      },
      {
        id: 'transportation',
        sourceLayer: 'transportation',
        color: [1.0, 1.0, 1.0, 1.0],
      },
      {
        id: 'place',
        sourceLayer: 'place',
        color: [0.3, 0.3, 0.3, 1.0],
      },
    ],
  },
});
