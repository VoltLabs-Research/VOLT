import type { ClusterTransferJob } from '@/modules/cluster/api/entities/team-cluster-transfer';

export interface CreateTeamClusterTransferRequestInputDTO {
    teamId: string;
    teamClusterId: string;
    destinationClusterId: string;
}

export interface CreateTeamClusterTransferRequestOutputDTO {
    message: string;
    sourceClusterId: string;
    destinationClusterId: string;
    requestedJobs: ClusterTransferJob[];
}
