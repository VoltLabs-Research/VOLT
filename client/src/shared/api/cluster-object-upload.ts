import { buildBackendUrl } from '@/app/core/http/utilities/backend-origin';

export interface ClusterObjectUploadPart {
    url: string;
    offset: number;
    size: number;
}

export interface UploadClusterObjectPartsOptions {
    file: File;
    parts: ClusterObjectUploadPart[];
    concurrency?: number;
    scopeId?: string;
    maxAttempts?: number;
    retryDelayMs?: number;
    onProgress?: (loadedBytes: number) => void;
}

type UploadTask = () => Promise<void>;

interface QueuedUploadTask {
    run: UploadTask;
    resolve: () => void;
    reject: (error: unknown) => void;
}

const BROWSER_OBJECT_UPLOAD_PIPELINE = 6;
const DEFAULT_UPLOAD_MAX_ATTEMPTS = 3;
const DEFAULT_UPLOAD_RETRY_DELAY_MS = 1_000;

let uploadScopeCounter = 0;

const createUploadScopeId = (): string => {
    uploadScopeCounter += 1;
    return `cluster-object-upload-${uploadScopeCounter}`;
};

class FairUploadScheduler {
    private readonly queues = new Map<string, QueuedUploadTask[]>();
    private readonly queuedScopes = new Set<string>();
    private readonly scopeOrder: string[] = [];
    private activeCount = 0;

    constructor(private readonly maxActive: number) {}

    schedule(scopeId: string, run: UploadTask): Promise<void> {
        return new Promise((resolve, reject) => {
            const queue = this.queues.get(scopeId) ?? [];
            queue.push({ run, resolve, reject });
            this.queues.set(scopeId, queue);

            if (!this.queuedScopes.has(scopeId)) {
                this.scopeOrder.push(scopeId);
                this.queuedScopes.add(scopeId);
            }

            this.drain();
        });
    }

    private drain(): void {
        while (this.activeCount < this.maxActive && this.scopeOrder.length > 0) {
            const scopeId = this.scopeOrder.shift();
            if (!scopeId) {
                continue;
            }

            this.queuedScopes.delete(scopeId);
            const queue = this.queues.get(scopeId);
            const task = queue?.shift();

            if (!queue || !task) {
                this.queues.delete(scopeId);
                continue;
            }

            if (queue.length > 0) {
                this.scopeOrder.push(scopeId);
                this.queuedScopes.add(scopeId);
            } else {
                this.queues.delete(scopeId);
            }

            this.activeCount += 1;
            task.run()
                .then(task.resolve)
                .catch(task.reject)
                .finally(() => {
                    this.activeCount = Math.max(0, this.activeCount - 1);
                    this.drain();
                });
        }
    }
}

const uploadScheduler = new FairUploadScheduler(BROWSER_OBJECT_UPLOAD_PIPELINE);

const resolveUploadUrl = (url: string): string => {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    return buildBackendUrl(url);
};

class ObjectUploadError extends Error {
    constructor(
        message: string,
        readonly status?: number,
        readonly retriable = false
    ) {
        super(message);
        this.name = 'ObjectUploadError';
    }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
});

const isRetriableStatus = (status: number): boolean => {
    return status === 408 || status === 429 || status >= 500;
};

const uploadPart = (
    file: File,
    part: ClusterObjectUploadPart,
    onProgress?: (loadedBytes: number) => void
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const body = file.slice(part.offset, part.offset + part.size);

        xhr.open('PUT', resolveUploadUrl(part.url));
        xhr.timeout = 0;
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (event) => {
            onProgress?.(Math.min(part.size, event.loaded || 0));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress?.(part.size);
                resolve();
                return;
            }

            reject(new ObjectUploadError(
                `Object upload failed with status ${xhr.status}`,
                xhr.status,
                isRetriableStatus(xhr.status)
            ));
        };
        xhr.onerror = () => reject(new ObjectUploadError('Object upload failed', undefined, true));
        xhr.onabort = () => reject(new ObjectUploadError('Object upload aborted', undefined, false));
        xhr.ontimeout = () => reject(new ObjectUploadError('Object upload timed out', undefined, true));
        xhr.send(body);
    });
};

const uploadPartWithRetry = async (
    file: File,
    part: ClusterObjectUploadPart,
    maxAttempts: number,
    retryDelayMs: number,
    onProgress?: (loadedBytes: number) => void
): Promise<void> => {
    let attempt = 1;

    for (;;) {
        try {
            await uploadPart(file, part, onProgress);
            return;
        } catch (error) {
            const retriable = error instanceof ObjectUploadError && error.retriable;
            if (!retriable || attempt >= maxAttempts) {
                throw error;
            }

            await sleep(retryDelayMs * attempt);
            attempt += 1;
        }
    }
};

export const uploadClusterObjectParts = async ({
    file,
    parts,
    concurrency = parts.length,
    scopeId = createUploadScopeId(),
    maxAttempts = DEFAULT_UPLOAD_MAX_ATTEMPTS,
    retryDelayMs = DEFAULT_UPLOAD_RETRY_DELAY_MS,
    onProgress
}: UploadClusterObjectPartsOptions): Promise<void> => {
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(Math.floor(concurrency), parts.length));
    const partProgress = new Array<number>(parts.length).fill(0);
    let emittedLoadedBytes = 0;
    let totalObservedLoadedBytes = 0;

    const handlePartProgress = (index: number, loadedBytes: number): void => {
        const previousPartLoadedBytes = partProgress[index];
        const nextPartLoadedBytes = Math.max(previousPartLoadedBytes, Math.min(parts[index].size, loadedBytes));
        partProgress[index] = nextPartLoadedBytes;
        totalObservedLoadedBytes += nextPartLoadedBytes - previousPartLoadedBytes;

        const delta = Math.max(0, totalObservedLoadedBytes - emittedLoadedBytes);
        emittedLoadedBytes = Math.max(emittedLoadedBytes, totalObservedLoadedBytes);
        if (delta > 0) {
            onProgress?.(delta);
        }
    };

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < parts.length) {
            const index = nextIndex;
            nextIndex += 1;
            await uploadScheduler.schedule(scopeId, () => uploadPartWithRetry(
                file,
                parts[index],
                Math.max(1, Math.floor(maxAttempts)),
                Math.max(0, Math.floor(retryDelayMs)),
                (loadedBytes) => handlePartProgress(index, loadedBytes)
            ));
        }
    }));
};
