import type { ClusterTransferJobState } from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import type { PaginatedOutputDTO } from '@modules/team/application/dtos/common';
import type { ClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';

export interface ListTeamClusterTransferJobsInputDTO {
    teamId: string;
    teamClusterId: string;
    page?: number;
    limit?: number;
    state?: ClusterTransferJobState;
}

export type ListTeamClusterTransferJobsOutputDTO = PaginatedOutputDTO<ClusterTransferJobDTO>;
