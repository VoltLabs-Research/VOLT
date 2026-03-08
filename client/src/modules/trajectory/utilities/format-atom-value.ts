const MAX_SERIALIZED_LENGTH = 120;

const truncate = (value: string): string => {
    if (value.length <= MAX_SERIALIZED_LENGTH) {
        return value;
    }

    return `${value.slice(0, MAX_SERIALIZED_LENGTH - 3)}...`;
};

const formatAtomValue = (value: unknown, decimals: number): string => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toFixed(decimals) : String(value);
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (value === null || value === undefined) {
        return '-';
    }

    if (Array.isArray(value) || typeof value === 'object') {
        try {
            return truncate(JSON.stringify(value));
        } catch {
            return String(value);
        }
    }

    return String(value);
};

export default formatAtomValue;
