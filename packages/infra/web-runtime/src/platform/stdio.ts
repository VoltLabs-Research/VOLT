// A process's standard input: the pipe its parent writes (src/platform/pipe.ts), read in blocks by
// fs.readSync(0) and as a stream by process.stdin. Without a pipe it is at its end, as Node's stdin
// from /dev/null is.
import { Readable } from 'stream';
import { PipeReader, type PipeBuffers } from './pipe';

const CHUNK_BYTES = 64 * 1024;

let reader: PipeReader | null = null;

export const hasStdinPipe = (): boolean => reader !== null;

// Bytes read into `target`, blocking until some arrive; 0 at the end of input.
export const readStdinSync = (target: Uint8Array): number => reader?.readSync(target) ?? 0;

export const attachStdin = (pipe: PipeBuffers | undefined): Readable => {
    reader = pipe ? new PipeReader(pipe) : null;
    const stream = new Readable({
        read(){
            if(!reader){
                this.push(null);
                return;
            }
            const chunk = new Uint8Array(CHUNK_BYTES);
            reader.read(chunk).then(
                (count) => this.push(count > 0 ? Buffer.from(chunk.buffer, 0, count) : null),
                (error: Error) => this.destroy(error)
            );
        }
    });
    return Object.assign(stream, { fd: 0, isTTY: false });
};
