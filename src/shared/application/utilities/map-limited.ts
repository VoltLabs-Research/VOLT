export const mapLimited = async <T, R>(
    items: T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workerCount = Math.min(Math.max(limit, 1), items.length);

    const workers = Array.from({ length: workerCount }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await task(items[index]!, index);
        }
    });

    await Promise.all(workers);
    return results;
};
