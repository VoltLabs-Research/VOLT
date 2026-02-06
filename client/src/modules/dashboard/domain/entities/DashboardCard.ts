export type MetricKey = 'trajectories' | 'analysis' | string;

export interface DashboardCard {
    key: MetricKey;
    name: string;
    listingUrl?: string;
    pluginName?: string;
    count: string;
    rawCount: number;
    lastMonthStatus: number;
    series: number[];
    labels: string[];
    yDomain: { min: number; max: number };
};
