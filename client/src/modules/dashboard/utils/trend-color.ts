export const getTrendColor = (isPositiveTrend: boolean): string => {
    const colorVariable = isPositiveTrend ? '--accent-green' : '--accent-red';
    return getComputedStyle(document.documentElement).getPropertyValue(colorVariable).trim() || '#30d158';
};
