export const readNumberEnv = (key: string, fallback: number): number => {
    const rawValue = process.env[key]?.trim();
    if(!rawValue){
        return fallback;
    }

    const value = Number(rawValue);
    if(!Number.isFinite(value) || value < 0){
        throw new Error(`${key} must be zero or a positive number`);
    }

    return value;
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
