export const readNumberEnv = (key: string, fallback: number): number => {
    const value = Number(process.env[key]);
    if(Number.isFinite(value) && value > 0){
        return value;
    }

    return fallback;
};

export const readPositiveIntegerEnv = (key: string, fallback: number): number => {
    const rawValue = process.env[key]?.trim();
    if (!rawValue) {
        return fallback;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${key} must be a positive integer`);
    }

    return value;
};
