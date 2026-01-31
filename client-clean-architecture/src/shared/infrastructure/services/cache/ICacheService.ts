export interface CacheEntry<T>{
    data: T;
    timestamp: number;
    version?: string;
};

export default interface ICacheService<T>{
    get(key: string): CacheEntry<T> | null;
    set(key: string, data: T, version?: string): void;
    has(key: string, version?: string): boolean;
    delete(key: string): void;
    clear(): void;
    cleanup(maxAgeMs: number): void;
};
