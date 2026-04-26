import type { ClusterTransferJobState } from '@modules/cluster/domain/entities/ClusterTransferJob';
import type { PaginatedOutputDTO } from '@modules/team/application/dtos/common';
import type { ClusterTransferJobDTO } from '@modules/cluster/application/dtos/ClusterTransferJobDTO';

export interface ListTeamClusterTransferJobsInputDTO {
    teamId: string;
    teamClusterId: string;
    page?: number;
    limit?: number;
    state?: ClusterTransferJobState;
}

export type ListTeamClusterTransferJobsOutputDTO = PaginatedOutputDTO<ClusterTransferJobDTO>;
