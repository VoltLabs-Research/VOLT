export const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const asRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }
    return value;
};

