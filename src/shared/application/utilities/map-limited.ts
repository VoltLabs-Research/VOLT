import Bottleneck from 'bottleneck';

/**
 * Bounded-concurrency `map` for async tasks. Results keep input order and, like
 * `Promise.all`, the first rejection surfaces to the caller while already
 * scheduled tasks run to completion.
 *
 * The clamp is load-bearing: Bottleneck refuses any job whose weight exceeds
 * `maxConcurrent`, so a caller resolving its limit to 0 would see every item
 * fail instead of running serially.
 */
export const mapLimited = async <T, R>(
    items: T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
    const limiter = new Bottleneck({ maxConcurrent: Math.max(1, limit) });

    return Promise.all(items.map((item, index) => limiter.schedule(() => task(item, index))));
};
