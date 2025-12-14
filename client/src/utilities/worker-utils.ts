export enum TRANSFERABLE_TYPE {
    AUTO = 'auto',
    NONE = 'none'
}

export enum WorkerStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    RUNNING = 'RUNNING',
    ERROR = 'ERROR',
    TIMEOUT_EXPIRED = 'TIMEOUT_EXPIRED',
    KILLED = 'KILLED',
}

export const WORKER_TEMPLATE = (fnStr: string, deps: string[], transferable: string) => `
    ${deps.length > 0 ? `importScripts('${deps.join("','")}');` : ''}
    const fn = ${fnStr};
    onmessage = function(e) {
        const [args] = e.data;
        Promise.resolve(fn(...args))
        .then(result => {
            const isTransferable = (val) => 
                (typeof ArrayBuffer !== 'undefined' && val instanceof ArrayBuffer) || 
                (typeof MessagePort !== 'undefined' && val instanceof MessagePort) || 
                (typeof ImageBitmap !== 'undefined' && val instanceof ImageBitmap) || 
                (typeof OffscreenCanvas !== 'undefined' && val instanceof OffscreenCanvas);
            
            const transfers = '${transferable}' === 'auto' && isTransferable(result) ? [result] : [];
            postMessage(['SUCCESS', result], transfers);
        })
        .catch(error => {
            const errPayload = error instanceof Error ? error.message : error;
            postMessage(['ERROR', errPayload]);
        });
    };
`;

export const createWorkerBlobUrl = (
    fn: Function,
    deps: string[] = [],
    transferable: TRANSFERABLE_TYPE = TRANSFERABLE_TYPE.AUTO
): string => {
    const blobCode = WORKER_TEMPLATE(fn.toString(), deps, transferable);
    const blob = new Blob([blobCode], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
};

export const isTransferableArg = (arg: unknown): arg is Transferable => {
    return (
        (typeof ArrayBuffer !== 'undefined' && arg instanceof ArrayBuffer) ||
        (typeof MessagePort !== 'undefined' && arg instanceof MessagePort) ||
        (typeof ImageBitmap !== 'undefined' && arg instanceof ImageBitmap) ||
        (typeof OffscreenCanvas !== 'undefined' && arg instanceof OffscreenCanvas)
    );
};

export const getTransferableArgs = (args: unknown[]): Transferable[] => {
    return args.filter(isTransferableArg);
};

/**
 * Run a pure function in a Web Worker (one-shot, for non-React contexts)
 */
export const runInWorker = <T extends (...args: any[]) => any>(
    fn: T,
    ...args: Parameters<T>
): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
        const workerUrl = createWorkerBlobUrl(fn, [], TRANSFERABLE_TYPE.AUTO);
        const worker = new Worker(workerUrl);

        worker.onmessage = (e: MessageEvent) => {
            const [status, result] = e.data;
            worker.terminate();
            URL.revokeObjectURL(workerUrl);

            if (status === 'SUCCESS') {
                resolve(result);
            } else {
                reject(new Error(result));
            }
        };

        worker.onerror = (e) => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(e);
        };

        const transferList = getTransferableArgs(args);
        worker.postMessage([args], transferList);
    });
};

/**
 * Run a pure function in a Web Worker with fallback to sync execution
 */
export const runInWorkerWithFallback = async <T extends (...args: any[]) => any>(
    fn: T,
    ...args: Parameters<T>
): Promise<ReturnType<T>> => {
    try {
        return await runInWorker(fn, ...args);
    } catch {
        return fn(...args);
    }
};
