export const readNumberEnv = (key: string, fallback: number): number => {
    const value = Number(process.env[key]);
    if(Number.isFinite(value) && value > 0){
        return value;
    }

    return fallback;
};

export const readBooleanEnv = (key: string, fallback: boolean): boolean => {
    const rawValue = process.env[key]?.trim().toLowerCase();
    if (!rawValue) {
        return fallback;
    }

    return rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
};
