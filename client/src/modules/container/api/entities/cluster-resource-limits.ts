export type ClusterResourceStatus = 'Healthy' | 'Warning' | 'Critical';

export interface ClusterResourceLimits {
    maxCpus: number | null;
    maxMemoryMB: number | null;
    status: ClusterResourceStatus | null;
    lastUpdatedAt: string | null;
};
