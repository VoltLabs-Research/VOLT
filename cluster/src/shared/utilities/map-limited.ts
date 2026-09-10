import Bottleneck from 'bottleneck';

export const mapLimited = async <T, R>(
    items: T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
    const limiter = new Bottleneck({ maxConcurrent: Math.max(1, limit) });

    return Promise.all(items.map((item, index) => limiter.schedule(() => task(item, index))));
};
