export const SOCKET_ANALYSIS_EVENTS = {
    CREATED: 'analysis.created',
    STATUS_CHANGED: 'analysis.status.changed',
    LOG_SUBSCRIBE: 'subscribe_to_analysis_log',
    LOG_UNSUBSCRIBE: 'unsubscribe_from_analysis_log',
    LOG_CHUNK: 'analysis-log:chunk'
} as const;
