export const formatValueForPath = (value: number): string => {
    if (value === 0) {
        return '0';
    }

    const absValue = Math.abs(value);
    const result = absValue >= 1e6 || absValue < 0.001
        ? value.toExponential(3)
        : value.toPrecision(6).replace(/(?:\.0+|(?:(\.\d*?[1-9])0+))$/, '$1');

    return result.replace('e+', 'e');
};
