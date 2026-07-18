import type { Readable } from 'node:stream';

export interface DownloadStreamOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}
