interface InMemoryAbsoluteExpiryStoreOptions<TValue> {
    getExpiresAt: (value: TValue) => number;
    sweepIntervalMs: number;
}

/**
 * Stores entries in memory until their absolute expiration time passes.
 */
export class InMemoryAbsoluteExpiryStore<TKey, TValue> {
    private readonly entriesByKey = new Map<TKey, TValue>();
    private readonly sweepTimer: ReturnType<typeof setInterval>;

    constructor(private readonly options: InMemoryAbsoluteExpiryStoreOptions<TValue>) {
        this.sweepTimer = setInterval(() => this.sweepExpired(), this.options.sweepIntervalMs);
        this.sweepTimer.unref();
    }

    public set(key: TKey, value: TValue): this {
        this.entriesByKey.set(key, value);
        return this;
    }

    public get(key: TKey): TValue | undefined {
        return this.entriesByKey.get(key);
    }

    public delete(key: TKey): boolean {
        return this.entriesByKey.delete(key);
    }

    public entries(): IterableIterator<[TKey, TValue]> {
        return this.entriesByKey.entries();
    }

    public sweepExpired(now: number = Date.now()): void {
        for (const [key, value] of this.entries()) {
            if (this.isExpired(value, now)) {
                this.delete(key);
            }
        }
    }

    public isExpired(value: TValue, now: number = Date.now()): boolean {
        return this.options.getExpiresAt(value) <= now;
    }
}
