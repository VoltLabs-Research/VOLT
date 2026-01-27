export const formatNetworkSpeed = (kbs: number): string => {
    const { value, unit } = formatNetworkSpeedWithUnit(kbs);
    return `${value} ${unit}`;
};

export const formatNetworkSpeedWithUnit = (kbs: number): { value: string; unit: string } => {
    if (kbs < 1) {
        return { value: (kbs * 1024).toFixed(0), unit: 'B/s' };
    }
    if (kbs < 1024) {
        return { value: kbs.toFixed(1), unit: 'KB/s' };
    }
    if (kbs < 1024 * 1024) {
        return { value: (kbs / 1024).toFixed(2), unit: 'MB/s' };
    }
    return { value: (kbs / (1024 * 1024)).toFixed(2), unit: 'GB/s' };
};
