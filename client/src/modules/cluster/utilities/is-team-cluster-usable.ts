import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export const isTeamClusterUsable = (cluster: Pick<TeamCluster, 'status'>): boolean => {
    return cluster.status === TeamClusterStatus.Connected;
};

export const hasUsableTeamCluster = (clusters: Pick<TeamCluster, 'status'>[]): boolean => {
    return clusters.some(isTeamClusterUsable);
};
