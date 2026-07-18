import { fetchTile, parseTile } from './tile-parse';
import type { ParseLayer, TileDrawCommand } from './types';

export type WorkerRequest =
  | { type: 'setLayers'; layers: ParseLayer[] }
  | { type: 'load'; key: string; url: string; z: number; x: number; y: number }
  | { type: 'abort'; key: string };

export type WorkerResponse =
  | { type: 'loaded'; key: string; commands: TileDrawCommand[] }
  | { type: 'error'; key: string; message: string };

type LoadRequest = Extract<WorkerRequest, { type: 'load' }>;
type AbortRequest = Extract<WorkerRequest, { type: 'abort' }>;

const requests = new Map<string, AbortController>();
let layers: ParseLayer[] = [];

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  switch (request.type) {
    case 'setLayers':
      layers = request.layers;
      break;
    case 'load':
      loadTile(request);
      break;
    case 'abort':
      abort(request);
      break;
  }
};

async function loadTile(request: LoadRequest) {
  const { key, url, z, x, y } = request;
  const controller = new AbortController();
  requests.set(key, controller);

  try {
    const data = await fetchTile(url, controller.signal);
    const commands = data === null ? [] : parseTile(data, z, x, y, layers);
    const response: WorkerResponse = {
      type: 'loaded',
      key,
      commands,
    };
    self.postMessage(response, {
      transfer: commands.map((cmd) => cmd.positions.buffer),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    const message = error instanceof Error ? error.message : String(error);
    const response: WorkerResponse = {
      type: 'error',
      key,
      message,
    };
    self.postMessage(response);
  } finally {
    requests.delete(key);
  }
}

function abort(request: AbortRequest) {
  const { key } = request;
  requests.get(key)?.abort();
}
