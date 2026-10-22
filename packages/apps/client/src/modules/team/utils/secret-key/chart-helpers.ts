export const CHART_COLORS = {
    requests: 'var(--accent)'
} as const;

export type StatusCodeClass = '2xx' | '3xx' | '4xx' | '5xx' | 'other';

// 'other' covers 1xx and what isn't an HTTP status at all (0 for an aborted request), so neither
// reads as a server error.
export const getStatusCodeClass = (code: number): StatusCodeClass => {
    if (code >= 200 && code < 300) return '2xx';
    if (code >= 300 && code < 400) return '3xx';
    if (code >= 400 && code < 500) return '4xx';
    if (code >= 500 && code < 600) return '5xx';
    return 'other';
};
