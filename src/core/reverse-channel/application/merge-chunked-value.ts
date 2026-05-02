import { isRecord } from '@/support/type-guards/is-record';

type ChunkedArray = ChunkedValue[];
interface ChunkedRecord { [key: string]: ChunkedValue }
type ChunkedValue = boolean | ChunkedArray | ChunkedRecord | null | number | string;

const mergeChunkedArray = (target: ChunkedArray, incoming: ChunkedArray): ChunkedArray => {
    target.push(...incoming);
    return target;
};

const mergeChunkedRecord = (target: ChunkedRecord, incoming: ChunkedRecord): ChunkedRecord => {
    for (const [key, incomingValue] of Object.entries(incoming)) {
        target[key] = mergeChunkedValue(target[key] ?? null, incomingValue);
    }

    return target;
};

const mergeChunkedValue = (target: ChunkedValue, incoming: ChunkedValue): ChunkedValue => {
    if (incoming === null) return target;
    if (target === null) return incoming;

    if (Array.isArray(target) && Array.isArray(incoming)) {
        return mergeChunkedArray(target, incoming);
    }

    if (isRecord(target) && isRecord(incoming)) {
        return mergeChunkedRecord(target as ChunkedRecord, incoming);
    }

    return incoming;
};

export default mergeChunkedValue;
