interface HexStringSerializable {
    toHexString(): string;
}

interface StringSerializable {
    toString(): string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const toRecord = (value: unknown): Record<string, unknown> => {
    return isRecord(value) ? value : {};
};

const hasToHexString = (value: unknown): value is HexStringSerializable => {
    return isRecord(value) && typeof value.toHexString === 'function';
};

const hasToString = (value: unknown): value is StringSerializable => {
    return isRecord(value) && typeof value.toString === 'function';
};

export const readString = (value: unknown): string => {
    return typeof value === 'string' ? value : '';
};

export const readStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
};

export const readOptionalDate = (value: unknown): Date | undefined => {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return undefined;
};

const readObjectIdProperty = (value: unknown, propertyName: string): string => {
    if (!isRecord(value)) {
        return '';
    }

    return readString(value[propertyName]);
};

export const readDocumentId = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    const oidValue = readObjectIdProperty(value, '$oid');
    if (oidValue) {
        return oidValue;
    }

    const idValue = readObjectIdProperty(value, 'id');
    if (idValue) {
        return idValue;
    }

    if (hasToHexString(value)) {
        return value.toHexString();
    }

    if (hasToString(value)) {
        const serializedValue = value.toString();
        return serializedValue === '[object Object]' ? '' : serializedValue;
    }

    return '';
};
