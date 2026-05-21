export type BufferedQueueEnqueueResult = 'enqueued' | 'duplicate' | 'overflow';

interface BufferedQueueEntry<T> {
    item: T;
    dedupeKey?: string;
}

interface BufferedQueueDrainResult<T> {
    ok: boolean;
    failedItem?: T;
    error?: unknown;
}

export class BufferedDedupeQueue<T> {
    private readonly entries: Array<BufferedQueueEntry<T>> = [];
    private readonly dedupeKeys = new Set<string>();

    constructor(private readonly maxSize: number) {}

    get length(): number {
        return this.entries.length;
    }

    enqueue(item: T, dedupeKey?: string): BufferedQueueEnqueueResult {
        if (dedupeKey && this.dedupeKeys.has(dedupeKey)) {
            return 'duplicate';
        }

        if (this.entries.length >= this.maxSize) {
            return 'overflow';
        }

        if (dedupeKey) {
            this.dedupeKeys.add(dedupeKey);
        }

        this.entries.push({ item, dedupeKey });
        return 'enqueued';
    }

    drain(consumer: (item: T) => void): BufferedQueueDrainResult<T> {
        while (this.entries.length > 0) {
            const current = this.entries[0] as BufferedQueueEntry<T>;

            try {
                consumer(current.item);
            } catch (error) {
                return {
                    ok: false,
                    failedItem: current.item,
                    error
                };
            }

            this.entries.shift();
            if (current.dedupeKey) {
                this.dedupeKeys.delete(current.dedupeKey);
            }
        }

        return { ok: true };
    }

    clear(): void {
        this.entries.length = 0;
        this.dedupeKeys.clear();
    }
}
