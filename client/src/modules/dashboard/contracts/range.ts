import type { DashboardMetricsBucket } from '@volt/contracts/modules/dashboard/domain';

export type DashboardRangeKey = '7d' | '30d' | '12w';

export interface DashboardRangeOption{
    key: DashboardRangeKey;
    /** Segmented-control face. */
    shortLabel: string;
    /** Reads as a sentence tail: "8 in the last 7 days". */
    label: string;
    days: number;
    bucket: DashboardMetricsBucket;
}

/*
 * One window definition for the whole dashboard. Both the tiles and the chart
 * read the selected option, so the number in a tile and the shape in the chart
 * can never describe different stretches of time.
 */
export const DASHBOARD_RANGE_OPTIONS: readonly DashboardRangeOption[] = [
    {
        key: '7d',
        shortLabel: '7d',
        label: 'last 7 days',
        days: 7,
        bucket: 'day'
    },
    {
        key: '30d',
        shortLabel: '30d',
        label: 'last 30 days',
        days: 30,
        bucket: 'day'
    },
    {
        key: '12w',
        shortLabel: '12w',
        label: 'last 12 weeks',
        days: 84,
        bucket: 'week'
    }
];

export const DEFAULT_DASHBOARD_RANGE_KEY: DashboardRangeKey = '30d';

export const resolveDashboardRange = (key: DashboardRangeKey): DashboardRangeOption =>
    DASHBOARD_RANGE_OPTIONS.find((option) => option.key === key)
        ?? DASHBOARD_RANGE_OPTIONS[DASHBOARD_RANGE_OPTIONS.length - 1];
