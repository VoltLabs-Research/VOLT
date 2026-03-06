import type ICacheService from './ICacheService';
import type { CacheEntry } from './ICacheService';
import { registerSharedAppCleanup } from '@/shared/utils/app-cleanup-registry';

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

export interface MemoryCacheServiceOptions<T> {
    maxEntries?: number;
    maxAgeMs?: number;
    onEvict?: (key: string, entry: CacheEntry<T>) => void;
}

export default class MemoryCacheService<T> implements ICacheService<T>{
    private cache: Map<string, CacheEntry<T>> = new Map();
    private readonly maxEntries: number;
    private readonly maxAgeMs: number;
    private readonly onEvict?: (key: string, entry: CacheEntry<T>) => void;

    constructor(options?: MemoryCacheServiceOptions<T>){
        this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
        this.onEvict = options?.onEvict;

        registerSharedAppCleanup(() => {
            this.cleanup(this.maxAgeMs);
        });
    }

    get(key: string): CacheEntry<T> | null{
        const entry = this.cache.get(key);
        if(!entry) return null;

        if(this.isExpired(entry)){
            this.evictEntry(key, entry);
            return null;
        }

        this.touchEntry(key, entry);

        return entry;
    }

    set(key: string, data: T, version?: string): void{
        if(this.cache.has(key)){
            this.cache.delete(key);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            version
        });

        this.cleanup(this.maxAgeMs);
        this.enforceMaxEntries();
    }

    has(key: string, version?: string): boolean{
        const entry = this.get(key);
        if(!entry) return false;
        if(version && entry.version !== version) return false;
        return true;
    }

    delete(key: string): void{
        const entry = this.cache.get(key);
        if(!entry) return;

        this.evictEntry(key, entry);
    }

    clear(): void{
        for(const [key, entry] of this.cache.entries()){
            this.evictEntry(key, entry);
        }
    }

    cleanup(maxAgeMs: number): void{
        const now = Date.now();
        for(const [key, entry] of this.cache.entries()){
            if(now - entry.timestamp > maxAgeMs){
                this.evictEntry(key, entry);
            }
        }
    }

    private isExpired(entry: CacheEntry<T>): boolean{
        return Date.now() - entry.timestamp > this.maxAgeMs;
    }

    private touchEntry(key: string, entry: CacheEntry<T>): void{
        this.cache.delete(key);
        this.cache.set(key, entry);
    }

    private enforceMaxEntries(): void{
        while(this.cache.size > this.maxEntries){
            const oldestEntry = this.cache.entries().next().value;

            if(!oldestEntry){
                return;
            }

            const [key, entry] = oldestEntry;
            this.evictEntry(key, entry);
        }
    }

    private evictEntry(key: string, entry: CacheEntry<T>): void{
        this.cache.delete(key);
        this.onEvict?.(key, entry);
    }
};
