export const isRecord = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return Object.getPrototypeOf(value) !== Array.prototype;
};
