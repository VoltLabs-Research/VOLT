import { formatSize } from '@voltstack/bravais';

const BYTES_PER_KB = 1024;

export const formatNetworkSpeedWithUnit = (kbs: number) => {
    const [value, unit] = formatSize(kbs * BYTES_PER_KB).split(' ');
    return {
        value,
        unit: `${unit}/s`
    };
};

export const formatNetworkSpeed = (kbs: number): string => {
    const { value, unit } = formatNetworkSpeedWithUnit(kbs);
    return `${value} ${unit}`;
};
