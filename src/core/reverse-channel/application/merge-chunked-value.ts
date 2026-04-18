type ChunkedArray = ChunkedValue[];
type ChunkedRecord = Record<string, ChunkedValue>;
type ChunkedValue = boolean | ChunkedArray | ChunkedRecord | null | number | string;

const isChunkedRecord = (value: ChunkedValue): value is ChunkedRecord => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const mergeChunkedArray = (target: ChunkedArray, incoming: ChunkedArray): ChunkedArray => {
    for (let i = 0; i < incoming.length; i++) {
        target.push(incoming[i]);
    }

    return target;
};

const mergeChunkedRecord = (target: ChunkedRecord, incoming: ChunkedRecord): ChunkedRecord => {
    for (const [key, incomingValue] of Object.entries(incoming)) {
        const targetValue = target[key];

        if (Array.isArray(targetValue) && Array.isArray(incomingValue)) {
            target[key] = mergeChunkedArray(targetValue, incomingValue);
            continue;
        }

        if (isChunkedRecord(targetValue) && isChunkedRecord(incomingValue)) {
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

    if (Array.isArray(target) && Array.isArray(incoming)) {
        return mergeChunkedArray(target, incoming);
    }

    if (isChunkedRecord(target) && isChunkedRecord(incoming)) {
        return mergeChunkedRecord(target, incoming);
    }

    return incoming;
};

export default mergeChunkedValue;
