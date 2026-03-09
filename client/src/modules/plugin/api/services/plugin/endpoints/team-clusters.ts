import { paginated } from '@/app/core/http/utilities/create-service';

import type { ListPluginTeamClustersInputDTO, ListPluginTeamClustersOutputDTO } from '@/modules/plugin/api/dtos/plugin/list-team-clusters';

const endpoints = {
    listTeamClusters: paginated<ListPluginTeamClustersInputDTO, ListPluginTeamClustersOutputDTO>('/:teamId/clusters', {
        client: 'teamClusters'
    })
};

export default endpoints;
