export const readString = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${fieldName} is required`);
    }

    return value;
};

export const readRecord = (value: unknown, fieldName: string): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${fieldName} must be an object`);
    }

    const record: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
        record[key] = entryValue;
    }

    return record;
};

export const toPayloadRecord = (value: Record<string, unknown> | undefined): Record<string, unknown> => {
    const emptyRecord: Record<string, unknown> = {};
    return value || emptyRecord;
};
