import type { SystemMetrics } from '@modules/system/value-objects/SystemMetrics';

type SerializedSystemMetrics = Omit<SystemMetrics, 'timestamp'> & {
    timestamp: string;
};

export const serializeSystemMetrics = (metrics: SystemMetrics): string => JSON.stringify(metrics);

const hydrateSystemMetrics = (metrics: SerializedSystemMetrics): SystemMetrics => ({
    ...metrics,
    timestamp: new Date(metrics.timestamp)
});

export const deserializeSystemMetrics = (payload: string): SystemMetrics => (
    hydrateSystemMetrics(JSON.parse(payload) as SerializedSystemMetrics)
);
