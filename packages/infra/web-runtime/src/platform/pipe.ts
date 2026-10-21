// A one-way byte pipe between two workers over a SharedArrayBuffer ring: what a child's stdin is.
// The reading side can block (fs.readSync(0), which programs compiled for Node use) or wait
// asynchronously (process.stdin); the writing side never blocks, queueing what does not fit yet.

import { ownBytes } from './bytes';

const READ_INDEX = 0;
const WRITE_INDEX = 1;
const CLOSED = 2;
const CONTROL_BYTES = 16;
const DEFAULT_CAPACITY = 1 << 20;

export interface PipeBuffers {
    shared: SharedArrayBuffer;
}

// The capacity is a power of two, so ring offsets stay continuous as the indices wrap.
export const createPipe = (capacity = DEFAULT_CAPACITY): PipeBuffers => {
    if((capacity & (capacity - 1)) !== 0){
        throw new RangeError(`pipe capacity must be a power of two, got ${capacity}`);
    }
    return { shared: new SharedArrayBuffer(CONTROL_BYTES + capacity) };
};

class PipeEnd {
    protected readonly control: Int32Array;
    protected readonly data: Uint8Array;

    constructor(buffers: PipeBuffers){
        this.control = new Int32Array(buffers.shared, 0, CONTROL_BYTES / 4);
        this.data = new Uint8Array(buffers.shared, CONTROL_BYTES);
    }

    // Indices count bytes ever written and read, modulo 2^31; their difference is what is buffered.
    protected buffered(): number {
        return (Atomics.load(this.control, WRITE_INDEX) - Atomics.load(this.control, READ_INDEX)) | 0;
    }
}

export class PipeWriter extends PipeEnd {
    private readonly queue: Uint8Array[] = [];
    private ending = false;
    private draining = false;

    write(chunk: Uint8Array): void {
        if(this.ending || Atomics.load(this.control, CLOSED)){
            return;
        }
        this.queue.push(ownBytes(chunk));
        this.drain();
    }

    end(): void {
        this.ending = true;
        this.drain();
    }

    private flush(): void {
        while(this.queue.length > 0){
            const space = this.data.length - this.buffered();
            if(space === 0){
                return;
            }
            const chunk = this.queue[0];
            const count = Math.min(space, chunk.length);
            let write = Atomics.load(this.control, WRITE_INDEX);
            for(let offset = 0; offset < count;){
                const at = (write >>> 0) % this.data.length;
                const run = Math.min(count - offset, this.data.length - at);
                this.data.set(chunk.subarray(offset, offset + run), at);
                offset += run;
                write = (write + run) | 0;
            }
            Atomics.store(this.control, WRITE_INDEX, write);
            Atomics.notify(this.control, WRITE_INDEX);
            if(count === chunk.length){
                this.queue.shift();
            }else{
                this.queue[0] = chunk.subarray(count);
            }
        }
    }

    // Writes what fits, then waits for the reader to make room for the rest.
    private drain(): void {
        if(this.draining){
            return;
        }
        this.flush();
        if(this.queue.length === 0){
            if(this.ending){
                Atomics.store(this.control, CLOSED, 1);
                Atomics.notify(this.control, WRITE_INDEX);
            }
            return;
        }
        this.draining = true;
        const read = Atomics.load(this.control, READ_INDEX);
        const wait = Atomics.waitAsync(this.control, READ_INDEX, read);
        void (wait.async ? wait.value : Promise.resolve()).then(() => {
            this.draining = false;
            this.drain();
        });
    }
}

export class PipeReader extends PipeEnd {
    // Bytes read into `target`; 0 at the end of the stream. Blocks until some are available.
    readSync(target: Uint8Array): number {
        for(;;){
            const count = this.take(target);
            if(count > 0 || Atomics.load(this.control, CLOSED)){
                return count;
            }
            Atomics.wait(this.control, WRITE_INDEX, Atomics.load(this.control, WRITE_INDEX));
        }
    }

    async read(target: Uint8Array): Promise<number> {
        for(;;){
            const count = this.take(target);
            if(count > 0 || Atomics.load(this.control, CLOSED)){
                return count;
            }
            await Atomics.waitAsync(this.control, WRITE_INDEX, Atomics.load(this.control, WRITE_INDEX)).value;
        }
    }

    private take(target: Uint8Array): number {
        const count = Math.min(this.buffered(), target.length);
        let read = Atomics.load(this.control, READ_INDEX);
        for(let offset = 0; offset < count;){
            const at = (read >>> 0) % this.data.length;
            const run = Math.min(count - offset, this.data.length - at);
            target.set(this.data.subarray(at, at + run), offset);
            offset += run;
            read = (read + run) | 0;
        }
        if(count > 0){
            Atomics.store(this.control, READ_INDEX, read);
            Atomics.notify(this.control, READ_INDEX);
        }
        return count;
    }
}
