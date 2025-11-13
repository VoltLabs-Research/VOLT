export class RequestDeduplicator{
    private pendingRequests = new Map<string, Promise<any>>();

    async deduplicate<T>(
        key: string,
        request: () => Promise<T>
    ): Promise<T>{
        if(this.pendingRequests.has(key)){
            return this.pendingRequests.get(key);
        }

        const promise = request().finally(() => {
            this.pendingRequests.delete(key);
        });

        this.pendingRequests.set(key, promise);
        return promise;
    }
}

export const requestDeduplicator = new RequestDeduplicator();

export const generateDeduplicationKey = (method: string, url: string): string => {
  return `${method.toUpperCase()}:${url}`;
}