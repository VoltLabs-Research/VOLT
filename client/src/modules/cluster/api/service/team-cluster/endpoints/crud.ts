import { paginated, post } from '@/app/core/http/utilities/create-service';
import type { CreateTeamClusterInputDTO, CreateTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/create-team-cluster';
import type { ListTeamClustersInputDTO, ListTeamClustersOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/list-team-clusters';

export default {
    create: post<CreateTeamClusterInputDTO, CreateTeamClusterOutputDTO>('/:teamId/clusters'),
    listByTeamId: paginated<ListTeamClustersInputDTO, ListTeamClustersOutputDTO>('/:teamId/clusters')
};
