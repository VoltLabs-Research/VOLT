export const isRecord = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) return false;
    if (Array.isArray(value)) return false;
    if (value instanceof Uint8Array) return false;
    return true;
};
