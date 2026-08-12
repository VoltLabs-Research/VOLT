import type { DashboardCardDelta } from '@/modules/dashboard/contracts/cards';

/*
 * Below this many rows in the comparison period, a percentage is noise wearing
 * authority: going from 1 to 2 is "+100%". Under the threshold we report the
 * movement that actually happened instead.
 */
const MIN_PERCENT_DENOMINATOR = 5;

export const buildDelta = (current: number, previous: number): DashboardCardDelta => {
    const absolute = current - previous;

    if (absolute === 0) {
        return {
            direction: 'flat',
            magnitude: ''
        };
    }

    const direction = absolute > 0 ? 'up' : 'down';

    /*
     * Spelled out rather than left as a bare number: sitting next to a sibling
     * tile that reads "12%", a lone "3" would be read as three percent.
     */
    if (previous < MIN_PERCENT_DENOMINATOR) {
        return {
            direction,
            magnitude: `${Math.abs(absolute)} ${absolute > 0 ? 'more' : 'fewer'}`
        };
    }

    return {
        direction,
        magnitude: `${Math.abs(Math.round((absolute / previous) * 100))}%`
    };
};

export const abbreviateNumber = (value: number): string => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}b`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
    return String(value);
};
