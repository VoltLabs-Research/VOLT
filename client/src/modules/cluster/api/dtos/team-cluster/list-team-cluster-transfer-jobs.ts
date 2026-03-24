import type { ClusterTransferJob, ClusterTransferJobState } from '@/modules/cluster/api/entities/team-cluster-transfer';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

export interface ListTeamClusterTransferJobsInputDTO {
    teamId: string;
    teamClusterId: string;
    page?: number;
    limit?: number;
    state?: ClusterTransferJobState;
}

export type ListTeamClusterTransferJobsOutputDTO = PaginatedResponse<ClusterTransferJob>;
