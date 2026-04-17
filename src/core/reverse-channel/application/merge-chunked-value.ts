import { isRecord } from '@/support/type-guards/isRecord';

type ChunkedArray = ChunkedValue[];
type ChunkedRecord = Record<string, ChunkedValue>;
type ChunkedValue = boolean | ChunkedArray | ChunkedRecord | null | number | string;

const mergeChunkedArray = (target: ChunkedArray, incoming: ChunkedArray): ChunkedArray => {
    for (let i = 0; i < incoming.length; i++) {
        target.push(incoming[i]);
    }

    return target;
};

const mergeChunkedRecord = (target: ChunkedRecord, incoming: ChunkedRecord): ChunkedRecord => {
    for (const [key, incomingValue] of Object.entries(incoming)) {
        const targetValue = target[key];

        if (targetValue instanceof Array && incomingValue instanceof Array) {
            target[key] = mergeChunkedArray(targetValue, incomingValue);
            continue;
        }

        if (isRecord(targetValue) && isRecord(incomingValue)) {
            target[key] = mergeChunkedRecord(targetValue, incomingValue);
            continue;
        }

        target[key] = incomingValue;
    }

    return target;
};

/**
 * Merges partial data chunks (arrays or objects) into a single structure.
 */
const mergeChunkedValue = (target: ChunkedValue, incoming: ChunkedValue): ChunkedValue => {
    if (incoming === null) return target;
    if (target === null) return incoming;

    if (target instanceof Array && incoming instanceof Array) {
        return mergeChunkedArray(target, incoming);
    }

    if (isRecord(target) && isRecord(incoming)) {
        return mergeChunkedRecord(target, incoming);
    }

    return incoming;
};

export default mergeChunkedValue;
