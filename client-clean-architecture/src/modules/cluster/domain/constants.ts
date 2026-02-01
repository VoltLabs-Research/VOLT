export const MAX_HISTORY_POINTS = 60;

export const DEFAULT_CLUSTER_ID = 'main-cluster';

export const CHART_COLORS = {
    // Generic colors
    blue: '#0A84FF',
    green: '#30D158',
    orange: '#FF9F0A',
    pink: '#C73A63',
    // Semantic colors
    mongodb: '#0A84FF',
    redis: '#30D158',
    minio: '#C73A63',
    server: '#FF9F0A',
    incoming: '#0A84FF',
    outgoing: '#30D158',
    read: '#0A84FF',
    write: '#30D158',
    iops: '#FF9F0A',
    queries: '#0A84FF',
    connections: '#30D158',
    latency: '#FF9F0A'
} as const;

export const STATUS_COLORS = {
    healthy: '#30D158',
    warning: '#FF9F0A',
    critical: '#FF453A'
} as const;

export const SOCKET_EVENTS = {
    metricsAll: 'metrics:all',
    metricsHistory: 'metrics:history',
    metricsError: 'metrics:error'
} as const;
