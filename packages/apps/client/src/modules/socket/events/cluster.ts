export const SOCKET_CLUSTER_METRICS_EVENTS = {
    METRICS_ALL: 'metrics:all',
    METRICS_HISTORY: 'metrics:history'
} as const;

export const SOCKET_TEAM_CLUSTER_EVENTS = {
    LIFECYCLE_UPDATED: 'team-cluster.updated',
    SUBSCRIBE: 'subscribe_to_team_cluster'
} as const;
