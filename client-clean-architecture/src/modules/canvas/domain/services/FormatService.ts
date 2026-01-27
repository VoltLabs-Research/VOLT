/**
 * Deep merges two objects recursively.
 * Pure function - deterministic, no side effects.
 *
 * @param base - Base object
 * @param patch - Object with values to merge
 * @returns New merged object
 */
export const deepMerge = <T extends object>(base: T, patch: Partial<T>): T => {
    const out: any = Array.isArray(base) ? [...base] : { ...base };

    for (const key in patch) {
        const value: any = patch[key];
        if (value === undefined) continue;

        if (Array.isArray(value)) {
            out[key] = [...value];
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            out[key] = deepMerge((out[key] ?? {}) as any, value);
        } else {
            out[key] = value;
        }
    }

    return out;
};

/**
 * Size units for formatting.
 */
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Formats bytes to a human-readable string.
 * Pure function - deterministic, no side effects.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);

    return `${value.toFixed(2).replace(/\.?0+$/, '')} ${SIZE_UNITS[i]}`;
};

/**
 * Formats a number using locale-specific formatting.
 * Pure function - deterministic, no side effects.
 *
 * @param n - Number to format
 * @returns Formatted string or '-' if not a finite number
 */
export const formatNumber = (n?: number): string => {
    if (Number.isFinite(n)) {
        return new Intl.NumberFormat().format(n as number);
    }
    return '-';
};

/**
 * Formats a percentage value.
 * Pure function.
 *
 * @param value - Value between 0 and 1
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
    return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Formats a duration in milliseconds to a human-readable string.
 * Pure function.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1.5s", "100ms")
 */
export const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
};
