import type { FsAttachment } from '../platform/fs/channel';
import type { PipeBuffers } from '../platform/pipe';

// Messages between a worker and the realm that started it (the host page for a backend, the backend
// for a process it spawned), besides the loopback network's own.
export interface BackendBootMessage {
    kind: 'boot';
    env: Record<string, string>;
    // The program it runs, argv[1] of its process: a script of the file system, for the runner's
    // worker (src/workers/node-runner.ts); a bundled program's own path otherwise.
    script?: string;
    argv: string[];
    cwd: string;
    // A backend mounts its own OPFS directory; a process it spawns shares the backend's.
    fs: { directory: string } | FsAttachment;
    // OPFS directory for the worker's SQLite databases, when it opens any.
    sqliteDirectory?: string;
    // Set for a spawned process: its stdout/stderr and process.send() go to the parent, and its stdin
    // reads the pipe the parent writes, when it has one.
    child?: { serialization: 'json' | 'advanced'; stdin?: PipeBuffers };
    // Set for a worker_threads Worker: its workerData, and parentPort messages go to the parent.
    thread?: { threadId: number; workerData: unknown };
}

export type BackendWorkerMessage =
    | { kind: 'booted' }
    | { kind: 'failed'; message: string }
    | { kind: 'exit'; code: number }
    | { kind: 'ipc'; message: unknown }
    | { kind: 'output'; stream: 'stdout' | 'stderr'; chunk: Uint8Array };

// From the parent to a spawned process.
export type ParentToChildMessage =
    | { kind: 'ipc'; message: unknown }
    | { kind: 'signal'; signal: string }
    | { kind: 'disconnect' };
