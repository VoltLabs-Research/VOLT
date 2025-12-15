/**
 * Formats network speed in KB/s to a human-readable string
 * @param kbs - Speed in kilobytes per second
 * @returns Formatted string like "1.5 MB/s" or "512 KB/s"
 */
export const formatNetworkSpeed = (kbs: number): string => {
    if (kbs < 1) return `${(kbs * 1024).toFixed(0)} B/s`;
    if (kbs < 1024) return `${kbs.toFixed(1)} KB/s`;
    if (kbs < 1024 * 1024) return `${(kbs / 1024).toFixed(2)} MB/s`;
    return `${(kbs / (1024 * 1024)).toFixed(2)} GB/s`;
};

/**
 * Formats network speed in KB/s to a human-readable object with separate value and unit
 * @param kbs - Speed in kilobytes per second
 * @returns Object with value and unit properties
 */
export const formatNetworkSpeedWithUnit = (kbs: number): { value: string; unit: string } => {
    if (kbs < 1) {
        return { value: (kbs * 1024).toFixed(0), unit: 'B/s' };
    } else if (kbs < 1024) {
        return { value: kbs.toFixed(1), unit: 'KB/s' };
    } else if (kbs < 1024 * 1024) {
        return { value: (kbs / 1024).toFixed(2), unit: 'MB/s' };
    } else {
        return { value: (kbs / (1024 * 1024)).toFixed(2), unit: 'GB/s' };
    }
};
