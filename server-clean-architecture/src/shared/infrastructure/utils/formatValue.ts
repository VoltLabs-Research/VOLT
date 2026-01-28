export const formatValueForPath = (value: number): string => {
    const absValue = Math.abs(value);
    let result: string;
    if (absValue >= 1e15) result = value.toExponential(3);
    else if (absValue >= 1e6) result = value.toExponential(3);
    else if (absValue < 0.001 && absValue !== 0) result = value.toExponential(3);
    else result = value.toPrecision(6).replace(/\.?0+$/, '');
    return result.replace('e+', 'e');
};
