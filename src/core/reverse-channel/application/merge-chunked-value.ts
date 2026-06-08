import type { JsonObject, JsonValue } from '@/support/types/json';
import { isRecord } from '@/support/type-guards/is-record';

const mergeChunkedArray = (target: JsonValue[], incoming: JsonValue[]): JsonValue[] => {
    target.push(...incoming);
    return target;
};

const mergeChunkedRecord = (target: JsonObject, incoming: JsonObject): JsonObject => {
    for (const [key, incomingValue] of Object.entries(incoming)) {
        target[key] = mergeChunkedValue(target[key] ?? null, incomingValue);
    }

    return target;
};

const mergeChunkedValue = (target: JsonValue, incoming: JsonValue): JsonValue => {
    if (incoming === null) return target;
    if (target === null) return incoming;

    if (Array.isArray(target) && Array.isArray(incoming)) {
        return mergeChunkedArray(target, incoming);
    }

    if (isRecord(target) && isRecord(incoming)) {
        return mergeChunkedRecord(target as JsonObject, incoming);
    }

    return incoming;
};

export default mergeChunkedValue;
