export const readNumberEnv = (key: string, fallback: number): number => {
    const value = Number(process.env[key]);
    if(Number.isFinite(value) && value > 0){
        return value;
    }

    return fallback;
};
