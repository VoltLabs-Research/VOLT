import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

/**
 * Returns whether a team cluster can be used to access the product flow.
 */
export const isTeamClusterUsable = (cluster: Pick<TeamCluster, 'status'>): boolean => {
    return cluster.status === TeamClusterStatus.Connected;
};

/**
 * Returns whether at least one cluster in the list is usable.
 */
export const hasUsableTeamCluster = (clusters: Pick<TeamCluster, 'status'>[]): boolean => {
    return clusters.some(isTeamClusterUsable);
};
