// Messages between the host page and a backend worker, besides the loopback network's own.
export interface BackendBootMessage {
    kind: 'boot';
    env: Record<string, string>;
    argv: string[];
    cwd: string;
    // OPFS directory holding this worker's file system, and the one its SQLite databases live in.
    fsDirectory: string;
    sqliteDirectory: string;
}

export type BackendWorkerMessage =
    | { kind: 'booted' }
    | { kind: 'failed'; message: string }
    | { kind: 'exit'; code: number };
