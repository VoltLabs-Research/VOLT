import { type Readable } from 'node:stream';

export interface TrajectoryNativeObjectStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
}
