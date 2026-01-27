export interface IGlbPreloadRepository {
    preload(url: string, onProgress?: (progress: number) => void): Promise<void>;
}
