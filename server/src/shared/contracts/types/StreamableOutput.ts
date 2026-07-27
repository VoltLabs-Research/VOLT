import type { Readable } from 'node:stream';

export interface StreamableOutput {
    stream: Readable;
}
