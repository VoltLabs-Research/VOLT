import { finished as finishedCallback, pipeline as pipelineCallback } from 'stream';

type Callback = (error?: Error | null) => void;

const promisify = <A extends unknown[]>(operation: (...args: [...A, Callback]) => unknown) => (
    (...args: A): Promise<void> => new Promise((resolve, reject) => {
        operation(...args, (error?: Error | null) => error ? reject(error) : resolve());
    })
);

// `stream.pipeline` also accepts an options object (with a signal) as its last argument.
export const pipeline = (...streams: unknown[]): Promise<void> => {
    const last = streams[streams.length - 1];
    const options = last && typeof last === 'object' && !('pipe' in last) && !('on' in last) && !(Symbol.asyncIterator in last) && typeof last !== 'function'
        ? streams.pop() as { signal?: AbortSignal }
        : undefined;
    return new Promise((resolve, reject) => {
        const stream = (pipelineCallback as (...args: unknown[]) => { destroy(error: Error): void })(...streams, (error?: Error | null) => error ? reject(error) : resolve());
        options?.signal?.addEventListener('abort', () => stream.destroy(new DOMException('The operation was aborted', 'AbortError')));
    });
};

export const finished = promisify(finishedCallback as (...args: [unknown, Callback]) => unknown);

export default { pipeline, finished };
