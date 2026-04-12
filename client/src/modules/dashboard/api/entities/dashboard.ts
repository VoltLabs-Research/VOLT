export type MetricKey = 'trajectories' | 'analysis' | string;

export interface DashboardCard {
    key: MetricKey;
    name: string;
    listingUrl?: string;
    count: string;
    rawCount: number;
    lastMonthStatus: number;
    series: number[];
    labels: string[];
    yDomain: { min: number; max: number };
};

export interface DashboardMetrics {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
};
