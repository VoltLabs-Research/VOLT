import { MAX_HISTORY_POINTS } from '@/modules/cluster/domain/constants';

interface PathGeneratorOptions {
    padding?: number;
    maxPoints?: number;
};

const DEFAULT_OPTIONS: PathGeneratorOptions = {
    padding: 5,
    maxPoints: MAX_HISTORY_POINTS
};

const getX = (index: number, maxPoints: number): number => 
    (index / (maxPoints - 1)) * 100;

const getY = (value: number, maxValue: number, padding: number): number => 
    100 - ((value / maxValue) * (100 - padding * 2) + padding);

export const createLinePath = (
    values: number[],
    maxValue: number,
    options: PathGeneratorOptions = {}
): string => {
    const { padding, maxPoints } = { ...DEFAULT_OPTIONS, ...options };
    
    if(values.length === 0) return '';

    let path = `M ${getX(0, maxPoints!)} ${getY(values[0], maxValue, padding!)}`;
    
    for(let i = 1; i < values.length; i++){
        path += ` L ${getX(i, maxPoints!)} ${getY(values[i], maxValue, padding!)}`;
    }
    
    return path;
};

export const createAreaPath = (linePath: string, dataLength: number, maxPoints: number = MAX_HISTORY_POINTS): string => {
    if(!linePath) return '';
    return `${linePath} L ${getX(dataLength - 1, maxPoints)} 100 L 0 100 Z`;
};

export const calculateMaxValue = (...arrays: number[][]): number => {
    const allMax = arrays.map((arr) => Math.max(...arr, 1));
    return Math.max(...allMax, 1);
};
