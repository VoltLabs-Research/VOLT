import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createWorkerBlobUrl,
    getTransferableArgs,
    TRANSFERABLE_TYPE,
    WorkerStatus
} from '@/utilities/worker-utils';

// Re-export for backward compatibility
export { TRANSFERABLE_TYPE, WorkerStatus } from '@/utilities/worker-utils';

type Options = {
    timeout?: number;
    remoteDependencies?: string[];
    autoTerminate?: boolean;
    transferable?: TRANSFERABLE_TYPE;
};

const DEFAULT_OPTIONS: Options = {
    timeout: undefined,
    remoteDependencies: [],
    autoTerminate: false,
    transferable: TRANSFERABLE_TYPE.AUTO
};

const useWorker = <T extends (...fnArgs: any[]) => any>(
    fn: T,
    options: Options = DEFAULT_OPTIONS
) => {
    const [status, setStatus] = useState<WorkerStatus>(WorkerStatus.PENDING);
    const workerRef = useRef<Worker | null>(null);
    const promiseRef = useRef<{ resolve: Function; reject: Function } | null>(null);
    const timeoutIdRef = useRef<number>(0);
    const isRunningRef = useRef(false);

    const {
        autoTerminate = DEFAULT_OPTIONS.autoTerminate,
        transferable = DEFAULT_OPTIONS.transferable,
        remoteDependencies = DEFAULT_OPTIONS.remoteDependencies,
        timeout = DEFAULT_OPTIONS.timeout
    } = options;

    const workerUrl = useMemo(() => {
        return createWorkerBlobUrl(fn, remoteDependencies!, transferable!);
    }, [fn, remoteDependencies, transferable]);

    const killWorker = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }

        if (timeoutIdRef.current) {
            window.clearTimeout(timeoutIdRef.current);
        }

        if (promiseRef.current) {
            promiseRef.current.reject(new Error('Worker terminated manually'));
            promiseRef.current = null;
        }

        isRunningRef.current = false;
        setStatus(WorkerStatus.KILLED);
    }, []);

    const getWorker = useCallback(() => {
        if (workerRef.current) return workerRef.current;

        const newWorker = new Worker(workerUrl);
        newWorker.onmessage = (e: MessageEvent) => {
            const [msgStatus, result] = e.data as [WorkerStatus, ReturnType<T>];
            if (msgStatus === 'SUCCESS') {
                promiseRef.current?.resolve(result);
                setStatus(WorkerStatus.SUCCESS);
            } else {
                promiseRef.current?.reject(result);
                setStatus(WorkerStatus.ERROR);
            }

            isRunningRef.current = false;
            promiseRef.current = null;

            if (autoTerminate) {
                killWorker();
            }
        };

        newWorker.onerror = (e) => {
            console.error('[useWorker] Worker error:', e.message, e);
            promiseRef.current?.reject(new Error(e.message || 'Worker Error'));
            setStatus(WorkerStatus.ERROR);
            isRunningRef.current = false;
        };

        workerRef.current = newWorker;
        return newWorker;
    }, [workerUrl, autoTerminate, killWorker]);

    const callWorker = useCallback((...args: Parameters<T>) => {
        if (isRunningRef.current) {
            console.warn('[useWorker] Worker is busy. Await the previous call.');
            return Promise.reject(new Error('Worker is busy'));
        }

        return new Promise<ReturnType<T>>((resolve, reject) => {
            isRunningRef.current = true;
            setStatus(WorkerStatus.RUNNING);
            promiseRef.current = { resolve, reject };

            const worker = getWorker();
            const transferList = transferable === TRANSFERABLE_TYPE.AUTO
                ? getTransferableArgs(args)
                : [];

            worker.postMessage([args], transferList);
            if (timeout) {
                timeoutIdRef.current = window.setTimeout(() => {
                    killWorker();
                    setStatus(WorkerStatus.TIMEOUT_EXPIRED);
                    reject(new Error('Timeout expired'));
                }, timeout);
            }
        });
    }, [getWorker, transferable, timeout, killWorker]);

    useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
            URL.revokeObjectURL(workerUrl);
        };
    }, [workerUrl]);

    const workerController = useMemo(() => ({
        status,
        kill: killWorker
    }), [status, killWorker]);

    return [callWorker, workerController] as const;
};

export default useWorker;