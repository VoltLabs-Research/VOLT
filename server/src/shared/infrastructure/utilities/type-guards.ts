export const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const asRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }
    return value;
};

export const hasStringProperty = <TKey extends string>(
    value: unknown,
    property: TKey
): value is Record<TKey, string> => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value[property] === 'string';
};

export const hasNumberProperty = <TKey extends string>(
    value: unknown,
    property: TKey
): value is Record<TKey, number> => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value[property] === 'number';
};
