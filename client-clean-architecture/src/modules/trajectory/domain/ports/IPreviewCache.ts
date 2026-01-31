export interface PreviewCacheEntry{
    blobUrl: string;
    version: string;
};

export default interface IPreviewCache{
    get(trajectoryId: string): PreviewCacheEntry | null;
    set(trajectoryId: string, blobUrl: string, version: string): void;
    has(trajectoryId: string, version?: string): boolean;
    delete(trajectoryId: string): void;
    clear(): void;
    cleanup(maxAgeMs: number): void;
};
