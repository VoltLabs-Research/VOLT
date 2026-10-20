import type { Readable } from 'node:stream';

export interface DownloadStreamOutput {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}
