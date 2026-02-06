import type ICacheService from './ICacheService';
import type { CacheEntry } from './ICacheService';

export default class MemoryCacheService<T> implements ICacheService<T>{
    private cache: Map<string, CacheEntry<T>> = new Map();

    get(key: string): CacheEntry<T> | null{
        return this.cache.get(key) ?? null;
    }

    set(key: string, data: T, version?: string): void{
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            version
        });
    }

    has(key: string, version?: string): boolean{
        const entry = this.cache.get(key);
        if(!entry) return false;
        if(version && entry.version !== version) return false;
        return true;
    }

    delete(key: string): void{
        this.cache.delete(key);
    }

    clear(): void{
        this.cache.clear();
    }

    cleanup(maxAgeMs: number): void{
        const now = Date.now();
        for(const [key, entry] of this.cache.entries()){
            if(now - entry.timestamp > maxAgeMs){
                this.cache.delete(key);
            }
        }
    }
};
