import type { ClusterTransferJobState } from '@modules/cluster/entities/ClusterTransferJob';
import type { PaginatedOutputDTO } from '@modules/cluster/dtos/_teamScoped';
import type { ClusterTransferJobDTO } from '@modules/cluster/dtos/ClusterTransferJobDTO';

export interface ListTeamClusterTransferJobsInputDTO {
    teamId: string;
    teamClusterId: string;
    page?: number;
    limit?: number;
    state?: ClusterTransferJobState;
}

export type ListTeamClusterTransferJobsOutputDTO = PaginatedOutputDTO<ClusterTransferJobDTO>;
