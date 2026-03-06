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

    constructor(){
        this.cache = new MemoryCacheService<PreviewData>();
        this.startCleanupInterval();
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
        this.cache.set(trajectoryId, { blobUrl }, version);
    }

    has(trajectoryId: string, version?: string): boolean{
        return this.cache.has(trajectoryId, version);
    }

    delete(trajectoryId: string): void{
        const entry = this.cache.get(trajectoryId);
        if(entry){
            URL.revokeObjectURL(entry.data.blobUrl);
        }
        this.cache.delete(trajectoryId);
    }

    clear(): void{
        this.cache.clear();
    }

    cleanup(maxAgeMs: number): void{
        this.cache.cleanup(maxAgeMs);
    }

    private startCleanupInterval(): void{
        if(this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => {
            this.cleanup(this.cleanupIntervalMs);
        }, this.cleanupIntervalMs);
    }
};
