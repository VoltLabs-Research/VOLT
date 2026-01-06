import { setImmediate } from 'node:timers/promises';

/**
 * Executes a loop in batches to prevent blocking the event loop.
 * Yields control back to the event loop after processing each batch.
 *
 * @param start - Starting index
 * @param end - Ending index (exclusive)
 * @param batchSize - Number of iterations per batch before yielding
 * @param callback - Function to execute for each iteration
 */
export async function asyncForLoop(
    start: number,
    end: number,
    batchSize: number,
    callback: (i: number) => void | Promise<void>
): Promise<void> {
    for (let i = start; i < end; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, end);
        for (let j = i; j < batchEnd; j++) {
            await callback(j);
        }
        if (batchEnd < end) {
            await setImmediate();
        }
    }
}

/**
 * Processes array items in batches to prevent blocking the event loop.
 *
 * @param items - Array of items to process
 * @param batchSize - Number of items per batch before yielding
 * @param callback - Function to execute for each item
 */
export async function asyncForEach<T>(
    items: T[],
    batchSize: number,
    callback: (item: T, index: number) => void | Promise<void>
): Promise<void> {
    await asyncForLoop(0, items.length, batchSize, async (i) => {
        await callback(items[i], i);
    });
}
