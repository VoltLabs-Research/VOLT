interface NetworkSpeedFormatted {
    value: string;
    unit: string;
};

export const formatNetworkSpeedWithUnit = (kbs: number): NetworkSpeedFormatted => {
    if(kbs < 1){
        return { value: (kbs * 1024).toFixed(0), unit: 'B/s' };
    }
    if(kbs < 1024){
        return { value: kbs.toFixed(1), unit: 'KB/s' };
    }
    if(kbs < 1024 * 1024){
        return { value: (kbs / 1024).toFixed(2), unit: 'MB/s' };
    }
    return { value: (kbs / (1024 * 1024)).toFixed(2), unit: 'GB/s' };
};

export const formatNetworkSpeed = (kbs: number): string => {
    const { value, unit } = formatNetworkSpeedWithUnit(kbs);
    return `${value} ${unit}`;
};
