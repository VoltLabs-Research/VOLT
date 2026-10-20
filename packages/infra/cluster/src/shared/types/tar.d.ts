declare module 'tar' {
    import type { Readable } from 'node:stream';

    export interface CreateOptions {
        cwd?: string;
        gzip?: boolean;
        portable?: boolean;
    }

    export interface ExtractOptions {
        cwd?: string;
    }

    export function c(options: CreateOptions, files: string[]): Readable;
    export function x(options: ExtractOptions): NodeJS.WritableStream;
}
