import { injectable } from 'tsyringe';
import type IPreviewCache from '../../domain/port/IPreviewCache';
import type { PreviewCacheEntry } from '../../domain/port/IPreviewCache';
import { MemoryCacheService } from '@/shared/infrastructure/services/cache';

interface PreviewData{
    blobUrl: string;
};

@injectable()
export default class TrajectoryPreviewCache implements IPreviewCache{
    private readonly cache: MemoryCacheService<PreviewData>;
    private readonly cleanupIntervalMs = 30 * 60 * 1000;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private readonly trackedTrajectoryIds = new Set<string>();

    constructor(){
        this.cache = new MemoryCacheService<PreviewData>();
        this.startCleanupInterval();
        this.registerHotDispose();
    }

    get(trajectoryId: string): PreviewCacheEntry | null{
        const entry = this.cache.get(trajectoryId);
        if(!entry) return null;
        return {
            blobUrl: entry.data.blobUrl,
            version: entry.version ?? ''
        };
    }

    set(trajectoryId: string, blobUrl: string, version: string): void{
        const existingEntry = this.cache.get(trajectoryId);

        if(existingEntry && existingEntry.data.blobUrl !== blobUrl){
            this.revokeBlobUrl(existingEntry.data.blobUrl);
        }

        this.cache.set(trajectoryId, { blobUrl }, version);
        this.trackedTrajectoryIds.add(trajectoryId);
    }

    has(trajectoryId: string, version?: string): boolean{
        return this.cache.has(trajectoryId, version);
    }

    delete(trajectoryId: string): void{
        const entry = this.cache.get(trajectoryId);
        if(entry){
            this.revokeBlobUrl(entry.data.blobUrl);
        }
        this.cache.delete(trajectoryId);
        this.trackedTrajectoryIds.delete(trajectoryId);
    }

    clear(): void{
        for(const trajectoryId of this.trackedTrajectoryIds){
            const entry = this.cache.get(trajectoryId);

            if(entry){
                this.revokeBlobUrl(entry.data.blobUrl);
            }
        }

        this.cache.clear();
        this.trackedTrajectoryIds.clear();
    }

    cleanup(maxAgeMs: number): void{
        const now = Date.now();
        const trajectoryIds = Array.from(this.trackedTrajectoryIds);

        for(const trajectoryId of trajectoryIds){
            const entry = this.cache.get(trajectoryId);

            if(!entry){
                this.trackedTrajectoryIds.delete(trajectoryId);
                continue;
            }

            if(now - entry.timestamp > maxAgeMs){
                this.revokeBlobUrl(entry.data.blobUrl);
                this.cache.delete(trajectoryId);
                this.trackedTrajectoryIds.delete(trajectoryId);
            }
        }
    }

    destroy(): void{
        this.stopCleanupInterval();
        this.clear();
    }

    private startCleanupInterval(): void{
        if(this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => {
            this.cleanup(this.cleanupIntervalMs);
        }, this.cleanupIntervalMs);
    }

    private stopCleanupInterval(): void{
        if(!this.cleanupTimer) return;
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
    }

    private revokeBlobUrl(blobUrl: string): void{
        URL.revokeObjectURL(blobUrl);
    }

    private registerHotDispose(): void{
        if(import.meta.hot){
            import.meta.hot.dispose(() => {
                this.destroy();
            });
        }
    }
};
