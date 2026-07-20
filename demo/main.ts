import { WebGLMap } from '../src/index.ts';
import { LngLat } from '../src/types.ts';

const center: LngLat = { lng: 121.517, lat: 25.047 };

new WebGLMap({
  containerId: 'map',
  center: center,
  zoom: 14,
  style: {
    sources: {
      openmaptiles: {
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
        color: [0.945, 0.929, 0.898, 1.0],
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'landcover',
        color: [0.89, 0.898, 0.843, 1.0],
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'landuse',
        color: [0.914, 0.882, 0.827, 1.0],
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'park',
        color: [0.796, 0.855, 0.749, 1.0],
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'water',
        color: [0.671, 0.788, 0.859, 1.0],
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        sourceLayer: 'waterway',
        color: [0.537, 0.686, 0.78, 1.0],
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'building',
        color: [0.867, 0.835, 0.784, 1.0],
      },
      {
        id: 'transportation',
        type: 'line',
        source: 'openmaptiles',
        sourceLayer: 'transportation',
        color: [1.0, 0.996, 0.988, 1.0],
      },
      {
        id: 'aeroway',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'aeroway',
        color: [0.871, 0.867, 0.898, 1.0],
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        sourceLayer: 'boundary',
        color: [0.647, 0.573, 0.616, 1.0],
      },
      {
        id: 'housenumber',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'housenumber',
        color: [0.616, 0.573, 0.522, 1.0],
      },
      {
        id: 'mountain_peak',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'mountain_peak',
        color: [0.396, 0.514, 0.333, 1.0],
      },
      {
        id: 'place',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'place',
        color: [0.176, 0.212, 0.251, 1.0],
      },
      {
        id: 'poi',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'poi',
        color: [0.729, 0.412, 0.271, 1.0],
      },
      {
        id: 'transportation_name',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'transportation_name',
        color: [0.341, 0.404, 0.463, 1.0],
      },
      {
        id: 'water_name',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'water_name',
        color: [0.239, 0.463, 0.596, 1.0],
      },
      {
        id: 'aerodrome_label',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'aerodrome_label',
        color: [0.427, 0.384, 0.549, 1.0],
      },
    ],
  },
});
