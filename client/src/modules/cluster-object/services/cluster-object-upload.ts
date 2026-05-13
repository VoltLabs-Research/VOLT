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
    onProgress?: (loadedBytes: number) => void;
}

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
    onProgress
}: UploadClusterObjectPartsOptions): Promise<void> => {
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(Math.floor(concurrency), parts.length));

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < parts.length) {
            const index = nextIndex;
            nextIndex += 1;
            await uploadPart(file, parts[index], onProgress);
        }
    }));
};
