export interface MetricsMetaEntry {
    displayName?: string;
    listingUrl?: string;
    pluginName?: string;
};

export interface DashboardMetrics {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
    meta?: Record<string, MetricsMetaEntry>;
};
