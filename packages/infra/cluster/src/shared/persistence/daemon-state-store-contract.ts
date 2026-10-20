export interface DaemonStateStore {
    setKeyIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
    decrementKey(key: string): Promise<number>;
    deleteKey(key: string): Promise<number>;
    deleteKeys(keys: string[]): Promise<number>;
    getValue(key: string): Promise<string | null>;
    setValueWithTtl(key: string, value: string, ttlSeconds: number): Promise<void>;
    appendListWithTtl(key: string, values: string[], ttlSeconds: number): Promise<void>;
    popListHead(key: string): Promise<string | null>;
    sweepExpired(): Promise<number>;
}

export const deadlineFromSeconds = (ttlSeconds: number | undefined): Date | null =>
    ttlSeconds === undefined ? null : new Date(Date.now() + ttlSeconds * 1000);
