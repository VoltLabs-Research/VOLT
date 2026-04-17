type RecordPrimitive = bigint | boolean | null | number | string | symbol | undefined;

export type RecordValue = RecordPrimitive | RecordLike | RecordValue[] | object;

export interface RecordLike {
    [key: string]: RecordValue;
}

export const isRecord = (value: RecordValue): value is RecordLike => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return Object.getPrototypeOf(value) !== Array.prototype;
};
