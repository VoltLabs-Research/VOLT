import os from 'node:os';

export const readPositiveIntegerEnv = (name: string): number | undefined => {
    const rawValue = process.env[name];
    if (rawValue === undefined || rawValue === '') {
        return undefined;
    }

    if (!/^[1-9]\d*$/.test(rawValue)) {
        return undefined;
    }

    return Number.parseInt(rawValue, 10);
};

export const getAvailableCpuCount = (): number => {
    if (typeof os.availableParallelism === 'function') {
        return os.availableParallelism();
    }

    return os.cpus().length;
};

export const getEffectiveMemoryLimitBytes = (): number => {
    const hostMemory = os.totalmem();
    const constrainedMemory = process.constrainedMemory();

    if (constrainedMemory > 0) {
        return Math.min(hostMemory, constrainedMemory);
    }

    return hostMemory;
};
