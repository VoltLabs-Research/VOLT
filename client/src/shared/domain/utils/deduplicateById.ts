/**
 * Merges `incoming` items into `existing`, filtering out any items whose `_id`
 * already appears in `existing`. Preserves the original order of `existing`.
 */
export function deduplicateById<T extends { _id: string }>(
    existing: T[],
    incoming: T[]
): T[] {
    const existingIds = new Set(existing.map((item) => item._id));
    return [...existing, ...incoming.filter((item) => !existingIds.has(item._id))];
}
