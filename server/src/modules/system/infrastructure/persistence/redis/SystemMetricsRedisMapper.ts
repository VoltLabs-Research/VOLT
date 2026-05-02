import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

type SerializedSystemMetrics = Omit<SystemMetrics, 'timestamp'> & {
    timestamp: Date | string;
};

export const serializeSystemMetrics = (metrics: SystemMetrics): string => JSON.stringify(metrics);

export const hydrateSystemMetrics = (metrics: SerializedSystemMetrics): SystemMetrics => ({
    ...metrics,
    timestamp: metrics.timestamp instanceof Date ? metrics.timestamp : new Date(metrics.timestamp)
});

export const deserializeSystemMetrics = (payload: string): SystemMetrics => (
    hydrateSystemMetrics(JSON.parse(payload) as SerializedSystemMetrics)
);
