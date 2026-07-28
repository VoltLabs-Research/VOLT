export const MIN_CLUSTER_CPU = 0.5;
export const MIN_CLUSTER_MEMORY_MB = 128;

export const clampClusterResourceValue = (
    value: number,
    min: number,
    max: number | null | undefined
) => {
    if (typeof max !== 'number' || !Number.isFinite(max)) {
        return Math.max(value, min);
    }

    return Math.min(Math.max(value, min), Math.max(min, max));
};
