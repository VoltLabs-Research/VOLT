declare module 'crypto-browserify' {
    export * from 'node:crypto';
}

// Resolved by scripts/build.mjs to the built entry point of the backend being bundled.
declare module 'volt-backend-entry';

// Dedicated-worker OPFS API (lib.webworker), which cannot be combined with lib.dom.
interface FileSystemReadWriteOptions {
    at?: number;
}

interface FileSystemSyncAccessHandle {
    read(buffer: AllowSharedBufferSource, options?: FileSystemReadWriteOptions): number;
    write(buffer: AllowSharedBufferSource, options?: FileSystemReadWriteOptions): number;
    truncate(newSize: number): void;
    getSize(): number;
    flush(): void;
    close(): void;
}

interface FileSystemFileHandle {
    createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}
