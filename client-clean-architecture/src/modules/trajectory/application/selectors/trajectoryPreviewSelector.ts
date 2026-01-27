type PreviewCacheEntry = {
    blobUrl: string;
    updatedAt: string;
    timestamp: number;
};

const previewCache = new Map<string, PreviewCacheEntry>();
const loadingPromises = new Map<string, Promise<string | null>>();

const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const CACHE_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

const sweepExpiredPreviews = (): void => {
    const now = Date.now();
    for (const [key, value] of previewCache.entries()) {
        if (now - value.timestamp > CACHE_MAX_AGE_MS) {
            URL.revokeObjectURL(value.blobUrl);
            previewCache.delete(key);
        }
    }
};

setInterval(sweepExpiredPreviews, CACHE_SWEEP_INTERVAL_MS);

export const buildTrajectoryPreviewCacheKey = (trajectoryId: string, updatedAt: string): string => {
    return `${trajectoryId}:${new Date(updatedAt).getTime()}`;
};

export const clearTrajectoryPreviewCache = (trajectoryId: string): void => {
    for (const [key, value] of previewCache.entries()) {
        if (key.startsWith(`${trajectoryId}:`)) {
            URL.revokeObjectURL(value.blobUrl);
            previewCache.delete(key);
        }
    }
};

const toBlobUrl = (base64Data: string): string => {
    const base64Content = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;

    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'image/png' });
    if (blob.size === 0) {
        throw new Error('Empty or invalid image data');
    }

    return URL.createObjectURL(blob);
};

export const getTrajectoryPreviewBlobUrl = async (params: {
    trajectoryId: string;
    updatedAt: string;
    loadPreviewBase64: (trajectoryId: string) => Promise<string>;
}): Promise<string | null> => {
    const { trajectoryId, updatedAt, loadPreviewBase64 } = params;
    const cacheKey = buildTrajectoryPreviewCacheKey(trajectoryId, updatedAt);

    const cached = previewCache.get(cacheKey);
    if (cached && cached.updatedAt === updatedAt) {
        return cached.blobUrl;
    }

    if (loadingPromises.has(cacheKey)) {
        const existingPromise = loadingPromises.get(cacheKey);
        return existingPromise || null;
    }

    clearTrajectoryPreviewCache(trajectoryId);

    const loadPromise = (async (): Promise<string | null> => {
        try {
            const base64Data = await loadPreviewBase64(trajectoryId);

            if (!base64Data || typeof base64Data !== 'string') {
                throw new Error('Invalid base64 response from server');
            }

            const blobUrl = toBlobUrl(base64Data);
            previewCache.set(cacheKey, {
                blobUrl,
                updatedAt,
                timestamp: Date.now()
            });

            return blobUrl;
        } finally {
            loadingPromises.delete(cacheKey);
        }
    })();

    loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
};
