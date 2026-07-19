import { WebGLMap } from '../src/index.ts';
import { LngLat } from '../src/types.ts';

const center: LngLat = { lng: 121.517, lat: 25.047 };

new WebGLMap({
  containerId: 'map',
  center: center,
  zoom: 14,
  style: {
    sources: {
      'openmaptiles-1': {
        type: 'vector',
        tiles: [
          'https://tiles.openstreetmap.us/vector/openmaptiles/{z}/{x}/{y}.mvt',
        ],
        maxzoom: 14,
      },
      'openmaptiles-2': {
        type: 'vector',
        tiles: [
          'https://tiles.openstreetmap.us/vector/openmaptiles/{z}/{x}/{y}.mvt',
        ],
        maxzoom: 14,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        color: [1.0, 1.0, 1.0, 1.0],
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles-1',
        sourceLayer: 'building',
        color: [0.6, 0.6, 0.6, 1.0],
      },
      {
        id: 'transportation',
        type: 'line',
        source: 'openmaptiles-1',
        sourceLayer: 'transportation',
        color: [0.5, 0.5, 0.5, 1.0],
      },
      {
        id: 'place',
        type: 'circle',
        source: 'openmaptiles-2',
        sourceLayer: 'place',
        color: [0.3, 0.3, 0.3, 1.0],
      },
    ],
  },
});
