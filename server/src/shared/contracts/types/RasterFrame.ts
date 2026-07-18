
import type { Readable } from 'node:stream';

export interface RasterFrameResult {
    stream: Readable;
    contentLength?: number;
    contentType: string;
    cacheControl?: string;
    filename?: string;
}
