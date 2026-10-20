import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';

const isTeamClusterUsable = (cluster: Pick<TeamCluster, 'status'>): boolean => {
    return cluster.status === TeamClusterStatus.Connected;
};

export const hasUsableTeamCluster = (clusters: Pick<TeamCluster, 'status'>[]): boolean => {
    return clusters.some(isTeamClusterUsable);
};
