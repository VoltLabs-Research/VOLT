import type { DashboardMetricsBucket } from '@volt/contracts/modules/dashboard/domain';

/*
 * These mirror TeamMetricsQueryService's bucket boundaries exactly — local
 * midnight, weeks starting Monday. Activity arrives from a different endpoint
 * than the trajectory/analysis series, and the two only line up on a shared
 * x-axis if both are bucketed by the same rule. Never toISOString() here: a UTC
 * key lands in the previous bucket for every timezone west of Greenwich.
 */

const startOfDay = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date: Date): Date => {
    const start = startOfDay(date);

    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

    return start;
};

export const toBucketKey = (date: Date, bucket: DashboardMetricsBucket): string => {
    const start = bucket === 'week' ? startOfWeek(date) : startOfDay(date);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/* Parsed from parts, because new Date('2026-08-12') is parsed as UTC midnight. */
export const parseBucketKey = (key: string): Date => {
    const [year, month, day] = key.split('-').map(Number);

    return new Date(year, (month ?? 1) - 1, day ?? 1);
};

/** Axis tick: terse enough to repeat across a row without colliding. */
export const formatBucketTick = (
    key: string,
    bucket: DashboardMetricsBucket,
    days: number
): string => {
    const date = parseBucketKey(key);

    if (bucket === 'day' && days <= 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};

/** Tooltip heading: unambiguous, since it is the reader's only anchor. */
export const formatBucketTitle = (key: string, bucket: DashboardMetricsBucket): string => {
    const date = parseBucketKey(key);

    if (bucket === 'week') {
        return `Week of ${date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        })}`;
    }

    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};
