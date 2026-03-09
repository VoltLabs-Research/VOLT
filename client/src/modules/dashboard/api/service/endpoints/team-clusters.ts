import { custom } from '@/app/core/http/utilities/create-service';
import type { ListDashboardTeamClustersInputDTO } from '@/modules/dashboard/api/dtos/list-team-clusters';
import type { DashboardTeamCluster } from '@/modules/dashboard/api/entities/team-cluster';

const DEFAULT_TEAM_CLUSTER_LIMIT = 50;

export default {
    listTeamClusters: custom<ListDashboardTeamClustersInputDTO, DashboardTeamCluster[]>(async ({ getClient }, params) => {
        const response = await getClient('teamCluster').getPaginated<DashboardTeamCluster>(`/${params.teamId}/clusters`, {
            page: 1,
            limit: params.limit ?? DEFAULT_TEAM_CLUSTER_LIMIT
        });

        return response.data;
    })
};
