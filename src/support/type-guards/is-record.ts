export const isRecord = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return Object.getPrototypeOf(value) !== Array.prototype;
};

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) return false;
    if (Array.isArray(value)) return false;
    if (value instanceof Uint8Array) return false;
    return true;
};
