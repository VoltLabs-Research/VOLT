import { finished as finishedCallback, pipeline as pipelineCallback } from 'stream';

type Callback = (error?: Error | null) => void;

interface PipelineOptions {
    signal?: AbortSignal;
    end?: boolean;
}

interface PipedReadable {
    pipe(destination: unknown, options: { end: boolean }): unknown;
    unpipe(destination: unknown): unknown;
    on(event: string, listener: (...args: never[]) => void): unknown;
    off(event: string, listener: (...args: never[]) => void): unknown;
    destroy(error?: Error): void;
}

interface PipedWritable {
    on(event: string, listener: (...args: never[]) => void): unknown;
    off(event: string, listener: (...args: never[]) => void): unknown;
}

const promisify = <A extends unknown[]>(operation: (...args: [...A, Callback]) => unknown) => (
    (...args: A): Promise<void> => new Promise((resolve, reject) => {
        operation(...args, (error?: Error | null) => error ? reject(error) : resolve());
    })
);

const abortError = (): Error => new DOMException('The operation was aborted', 'AbortError');

// `end: false` leaves the destination open for what is written to it next, as Node's pipeline does
// (FilesystemObjectStore.composeObject appends each part of an upload to one file this way).
// readable-stream's pipeline takes no options and always ends it, so the next part's pipeline would
// write after its end. Settles once the source has ended and all of it went to the destination.
const pipelineIntoOpenDestination = (streams: unknown[], signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    const destination = streams.pop() as PipedWritable;
    // The streams before the destination are piped together as usual, and their last one into it.
    const source = (streams.length > 1
        ? (pipelineCallback as (...args: unknown[]) => unknown)(...streams, (error?: Error | null) => {
            if(error){
                fail(error);
            }
        })
        : streams[0]) as PipedReadable;

    const cleanup = (): void => {
        source.off('end', done);
        source.off('close', closedEarly);
        source.off('error', fail);
        destination.off('error', fail);
        signal?.removeEventListener('abort', abort);
    };
    function done(): void {
        cleanup();
        resolve();
    }
    function fail(error: Error): void {
        cleanup();
        source.unpipe(destination);
        reject(error);
    }
    function closedEarly(): void {
        fail(Object.assign(new Error('Premature close'), { code: 'ERR_STREAM_PREMATURE_CLOSE' }));
    }
    function abort(): void {
        const error = abortError();
        source.destroy(error);
        fail(error);
    }

    if(signal?.aborted){
        abort();
        return;
    }
    signal?.addEventListener('abort', abort);
    source.on('end', done);
    source.on('close', closedEarly);
    source.on('error', fail);
    destination.on('error', fail);
    source.pipe(destination, { end: false });
});

// `stream.pipeline` also accepts an options object (with a signal and `end`) as its last argument.
export const pipeline = (...streams: unknown[]): Promise<void> => {
    const last = streams[streams.length - 1];
    const options = last && typeof last === 'object' && !('pipe' in last) && !('on' in last) && !(Symbol.asyncIterator in last) && typeof last !== 'function'
        ? streams.pop() as PipelineOptions
        : undefined;
    if(options?.end === false){
        return pipelineIntoOpenDestination(streams, options.signal);
    }
    return new Promise((resolve, reject) => {
        const stream = (pipelineCallback as (...args: unknown[]) => { destroy(error: Error): void })(...streams, (error?: Error | null) => error ? reject(error) : resolve());
        options?.signal?.addEventListener('abort', () => stream.destroy(abortError()));
    });
};

export const finished = promisify(finishedCallback as (...args: [unknown, Callback]) => unknown);

export default { pipeline, finished };
