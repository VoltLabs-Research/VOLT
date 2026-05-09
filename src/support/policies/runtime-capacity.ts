import os from 'node:os';

export const readPositiveIntegerEnv = (name: string): number | undefined => {
    const rawValue = process.env[name];
    if (!rawValue || !/^[1-9]\d*$/.test(rawValue)) {
        return undefined;
    }

    return Number.parseInt(rawValue, 10);
};

export const getAvailableCpuCount = (): number => {
    return os.availableParallelism();
};
