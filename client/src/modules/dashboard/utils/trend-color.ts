
export const getTrendColor = (isPositiveTrend: boolean): string => {
    const colorVariable = isPositiveTrend ? '--success' : '--danger';
    return getComputedStyle(document.documentElement).getPropertyValue(colorVariable).trim() || '#30d158';
};
