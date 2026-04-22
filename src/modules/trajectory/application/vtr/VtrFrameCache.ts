import { Service } from '@/core/decorators/service';
import type { VtrFrameData } from '@/modules/trajectory/infrastructure/codecs/vtr-reader';

// Why: decompressed frame chunks are 5-30 MB each; keeping them in RAM between
// requests is the single biggest latency win on repeated queries (getAtomsPage,
// getPropertyStats, getUniqueValues all touching the same frame). LRU bound so
// we never balloon past a configurable soft-cap, plus a TTL sweep so stale
// frames from finished analyses get reclaimed without relying on the process
// restarting.

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 64;

interface CacheEntry {
    key: string;
    frame: VtrFrameData;
    size: number;
    createdAt: number;
    lastAccessAt: number;
}

export interface VtrFrameCacheInit {
    ttlMs?: number;
    maxBytes?: number;
    maxEntries?: number;
}

const estimateFrameSize = (frame: VtrFrameData): number => {
    let size = frame.positions.byteLength + frame.types.byteLength;
    if (frame.ids) size += frame.ids.byteLength;
    for (const values of Object.values(frame.properties)) {
        size += values.byteLength;
    }
    return size;
};

@Service('vtrFrameCache')
export class VtrFrameCache {
    private readonly ttlMs: number;
    private readonly maxBytes: number;
    private readonly maxEntries: number;
    private readonly store = new Map<string, CacheEntry>();
    private totalBytes = 0;

    public constructor(init: VtrFrameCacheInit = {}) {
        this.ttlMs = init.ttlMs ?? DEFAULT_TTL_MS;
        this.maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;
        this.maxEntries = init.maxEntries ?? DEFAULT_MAX_ENTRIES;
    }

    public buildKey(trajectoryId: string, timestep: number): string {
        return `${trajectoryId}:${timestep}`;
    }

    public get(trajectoryId: string, timestep: number): VtrFrameData | null {
        const key = this.buildKey(trajectoryId, timestep);
        const entry = this.store.get(key);
        if (!entry) return null;
        const now = Date.now();
        if (now - entry.createdAt > this.ttlMs) {
            this.evict(key);
            return null;
        }
        entry.lastAccessAt = now;
        this.store.delete(key);
        this.store.set(key, entry);
        return entry.frame;
    }

    public put(trajectoryId: string, timestep: number, frame: VtrFrameData): void {
        const key = this.buildKey(trajectoryId, timestep);
        const existing = this.store.get(key);
        if (existing) {
            this.totalBytes -= existing.size;
            this.store.delete(key);
        }
        const size = estimateFrameSize(frame);
        this.store.set(key, {
            key,
            frame,
            size,
            createdAt: Date.now(),
            lastAccessAt: Date.now()
        });
        this.totalBytes += size;
        this.enforceLimits();
    }

    public invalidate(trajectoryId: string, timestep?: number): void {
        if (timestep !== undefined) {
            this.evict(this.buildKey(trajectoryId, timestep));
            return;
        }
        for (const key of [...this.store.keys()]) {
            if (key.startsWith(`${trajectoryId}:`)) this.evict(key);
        }
    }

    public clear(): void {
        this.store.clear();
        this.totalBytes = 0;
    }

    private evict(key: string): void {
        const entry = this.store.get(key);
        if (!entry) return;
        this.totalBytes -= entry.size;
        this.store.delete(key);
    }

    private enforceLimits(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now - entry.createdAt > this.ttlMs) this.evict(key);
        }
        while (this.store.size > this.maxEntries || this.totalBytes > this.maxBytes) {
            const oldestKey = this.store.keys().next().value;
            if (!oldestKey) break;
            this.evict(oldestKey);
        }
    }
}
