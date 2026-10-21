import type { FsChannelBuffers } from '../platform/fs/channel';

// Messages between a worker and the realm that started it (the host page for a backend, the backend
// for a process it spawned), besides the loopback network's own.
export interface BackendBootMessage {
    kind: 'boot';
    env: Record<string, string>;
    argv: string[];
    cwd: string;
    // A backend mounts its own OPFS directory; a process it spawns shares the backend's.
    fs: { directory: string } | { channel: FsChannelBuffers };
    // OPFS directory for the worker's SQLite databases, when it opens any.
    sqliteDirectory?: string;
    // Set for a spawned process: its stdout/stderr and process.send() go to the parent.
    child?: { serialization: 'json' | 'advanced' };
    // Set for a worker_threads Worker: its workerData, and parentPort messages go to the parent.
    thread?: { threadId: number; workerData: unknown };
}

export type BackendWorkerMessage =
    | { kind: 'booted' }
    | { kind: 'failed'; message: string }
    | { kind: 'exit'; code: number }
    | { kind: 'ipc'; message: unknown }
    | { kind: 'output'; stream: 'stdout' | 'stderr'; text: string };

// From the parent to a spawned process.
export type ParentToChildMessage =
    | { kind: 'ipc'; message: unknown }
    | { kind: 'signal'; signal: string }
    | { kind: 'disconnect' };
