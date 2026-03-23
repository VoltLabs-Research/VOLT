import os from 'node:os';

const BYTES_PER_MEGABYTE = 1024 * 1024;

export const readPositiveIntegerEnv = (name: string): number | undefined => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return undefined;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
        return undefined;
    }

    return parsedValue;
};

export const getAvailableCpuCount = (): number => {
    if (typeof os.availableParallelism === 'function') {
        return os.availableParallelism();
    }

    return os.cpus().length;
};

export const getEffectiveMemoryLimitBytes = (): number => {
    const hostMemory = os.totalmem();
    const constrainedMemory = typeof process.constrainedMemory === 'function'
        ? process.constrainedMemory()
        : 0;

    if (Number.isFinite(constrainedMemory) && constrainedMemory > 0) {
        return Math.min(hostMemory, constrainedMemory);
    }

    return hostMemory;
};

export const getEffectiveMemoryLimitMegabytes = (): number => {
    return Math.max(1, Math.floor(getEffectiveMemoryLimitBytes() / BYTES_PER_MEGABYTE));
};
