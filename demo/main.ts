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
        color: [0.969, 0.961, 0.945, 1.0],
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'landcover',
        color: [0.937, 0.929, 0.902, 1.0],
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'landuse',
        color: [0.91, 0.894, 0.855, 1.0],
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'park',
        color: [0.812, 0.871, 0.765, 1.0],
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'water',
        color: [0.678, 0.796, 0.867, 1.0],
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        sourceLayer: 'waterway',
        color: [0.545, 0.694, 0.784, 1.0],
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'building',
        color: [0.882, 0.855, 0.812, 1.0],
      },
      {
        id: 'transportation',
        type: 'line',
        source: 'openmaptiles',
        sourceLayer: 'transportation',
        color: [0.996, 0.988, 0.976, 1.0],
      },
      {
        id: 'aeroway',
        type: 'fill',
        source: 'openmaptiles',
        sourceLayer: 'aeroway',
        color: [0.882, 0.878, 0.91, 1.0],
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        sourceLayer: 'boundary',
        color: [0.69, 0.616, 0.659, 1.0],
      },
      {
        id: 'housenumber',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'housenumber',
        color: [0.639, 0.596, 0.545, 1.0],
        size: 5,
      },
      {
        id: 'mountain_peak',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'mountain_peak',
        color: [0.416, 0.529, 0.353, 1.0],
      },
      {
        id: 'place',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'place',
        color: [0.216, 0.255, 0.294, 1.0],
      },
      {
        id: 'poi',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'poi',
        color: [0.71, 0.435, 0.302, 1.0],
        size: 5,
      },
      {
        id: 'transportation_name',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'transportation_name',
        color: [0.361, 0.42, 0.478, 1.0],
      },
      {
        id: 'water_name',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'water_name',
        color: [0.278, 0.49, 0.612, 1.0],
      },
      {
        id: 'aerodrome_label',
        type: 'circle',
        source: 'openmaptiles',
        sourceLayer: 'aerodrome_label',
        color: [0.463, 0.42, 0.576, 1.0],
      },
    ],
  },
});
