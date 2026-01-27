export interface DeduplicateResult<T> {
    data: T;
    wasDeduplicated: boolean;
}

export class RequestDeduplicator {
    private pendingRequests = new Map<string, Promise<any>>();

    async deduplicate<T>(
        key: string,
        request: () => Promise<T>
    ): Promise<DeduplicateResult<T>> {
        if (this.pendingRequests.has(key)) {
            const data = await this.pendingRequests.get(key);
            return { data, wasDeduplicated: true };
        }

        const promise = request().finally(() => {
            this.pendingRequests.delete(key);
        });

        this.pendingRequests.set(key, promise);
        const data = await promise;
        return { data, wasDeduplicated: false };
    }
}

export const requestDeduplicator = new RequestDeduplicator();

export const generateDeduplicationKey = (method: string, url: string): string => {
    return `${method.toUpperCase()}:${url}`;
}
