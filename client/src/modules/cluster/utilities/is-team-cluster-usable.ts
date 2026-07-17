import { TeamClusterStatus } from '@/modules/cluster/api/types/team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/types/team-cluster';

export const isTeamClusterUsable = (cluster: Pick<TeamCluster, 'status'>): boolean => {
    return cluster.status === TeamClusterStatus.Connected;
};

export const hasUsableTeamCluster = (clusters: Pick<TeamCluster, 'status'>[]): boolean => {
    return clusters.some(isTeamClusterUsable);
};
