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
    onProgress?: (loadedBytes: number) => void;
}

type UploadTask = () => Promise<void>;

interface QueuedUploadTask {
    run: UploadTask;
    resolve: () => void;
    reject: (error: unknown) => void;
}

const BROWSER_OBJECT_UPLOAD_PIPELINE = 6;

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

const uploadPart = (
    file: File,
    part: ClusterObjectUploadPart,
    onProgress?: (loadedBytes: number) => void
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const body = file.slice(part.offset, part.offset + part.size);
        let lastLoaded = 0;

        xhr.open('PUT', resolveUploadUrl(part.url));
        xhr.timeout = 0;
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (event) => {
            const loaded = event.loaded || 0;
            const delta = Math.max(0, loaded - lastLoaded);
            lastLoaded = loaded;
            if (delta > 0) {
                onProgress?.(delta);
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const remaining = part.size - lastLoaded;
                if (remaining > 0) {
                    onProgress?.(remaining);
                }
                resolve();
                return;
            }

            reject(new Error(`Object upload failed with status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Object upload failed'));
        xhr.onabort = () => reject(new Error('Object upload aborted'));
        xhr.ontimeout = () => reject(new Error('Object upload timed out'));
        xhr.send(body);
    });
};

export const uploadClusterObjectParts = async ({
    file,
    parts,
    concurrency = parts.length,
    scopeId = createUploadScopeId(),
    onProgress
}: UploadClusterObjectPartsOptions): Promise<void> => {
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(Math.floor(concurrency), parts.length));

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < parts.length) {
            const index = nextIndex;
            nextIndex += 1;
            await uploadScheduler.schedule(scopeId, () => uploadPart(file, parts[index], onProgress));
        }
    }));
};
