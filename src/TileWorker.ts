import type { WorkerRequest, WorkerResponse } from './tile-worker';
import type { TileDrawCommand } from './types';

interface PendingTile {
  resolve: (commands: TileDrawCommand[]) => void;
  reject: (error: Error) => void;
}

export class TileWorker {
  private worker: Worker;
  private pending = new Map<string, PendingTile>();

  constructor() {
    this.worker = new Worker(new URL('./tile-worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = this.pending.get(response.key);
      if (entry === undefined) return;
      this.pending.delete(response.key);

      if (response.type === 'loaded') entry.resolve(response.commands);
      else entry.reject(new Error(response.message));
    };

    this.worker.onerror = (event) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`Tile worker crashed: ${event.message}`));
      }
      this.pending.clear();
    };
  }

  loadTile(key: string, url: string, z: number, x: number, y: number) {
    return new Promise<TileDrawCommand[]>((resolve, reject) => {
      this.pending.set(key, { resolve, reject });
      const request: WorkerRequest = {
        type: 'load',
        key,
        url,
        z,
        x,
        y,
      };
      this.worker.postMessage(request);
    });
  }

  abort(key: string) {
    const entry = this.pending.get(key);
    if (entry === undefined) return;
    this.pending.delete(key);
    entry.reject(new DOMException('Aborted', 'AbortError'));
    const request: WorkerRequest = { type: 'abort', key };
    this.worker.postMessage(request);
  }

  isLoading(key: string): boolean {
    return this.pending.has(key);
  }

  loadingKeys(): IterableIterator<string> {
    return this.pending.keys();
  }
}
