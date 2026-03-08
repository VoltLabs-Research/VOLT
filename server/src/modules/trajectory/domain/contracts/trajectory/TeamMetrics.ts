export interface TeamMetricTarget {
    kind: 'plugin-exposure-listing' | 'plugins-dashboard';
    trajectoryId?: string;
    pluginId?: string;
    exposureId?: string;
};

export interface TeamMetricMetaEntry {
    displayName?: string;
    pluginName?: string;
    target?: TeamMetricTarget;
};

export interface TeamMetricsSnapshot {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
    meta?: Record<string, TeamMetricMetaEntry>;
};
