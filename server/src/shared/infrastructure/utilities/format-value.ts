export const formatValueForPath = (value: number): string => {
    if (!Number.isFinite(value)) {
        return String(value);
    }

    if (Object.is(value, -0) || value === 0) {
        return '0';
    }

    const absValue = Math.abs(value);
    let result: string;

    if (absValue >= 1e6) {
        result = value.toExponential(3);
    } else if (absValue < 0.001 && absValue !== 0) {
        result = value.toExponential(3);
    } else {
        result = value.toPrecision(6).replace(/(?:\.0+|(?:(\.\d*?[1-9])0+))$/, '$1');
    }

    return result.replace('e+', 'e');
};
