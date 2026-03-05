export interface GetTeamMetricsInputDTO {
    teamId: string;
}

interface MetricMeta {
    displayName?: string;
    listingUrl?: string;
    pluginName?: string;
}

export interface GetTeamMetricsOutputDTO {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
    meta?: Record<string, MetricMeta>;
}
