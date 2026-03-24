import type { ClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';

export interface CreateTeamClusterTransferRequestInputDTO {
    teamId: string;
    teamClusterId: string;
    destinationClusterId: string;
    authenticatedUserId: string;
}

export interface CreateTeamClusterTransferRequestOutputDTO {
    message: string;
    sourceClusterId: string;
    destinationClusterId: string;
    requestedJobs: ClusterTransferJobDTO[];
}
