import { post } from '@/app/core/http/utilities/create-service';
import type { DeleteTeamClusterInputDTO, DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/reveal-team-cluster-credentials';

export default {
    deleteById: post<DeleteTeamClusterInputDTO, DeleteTeamClusterOutputDTO>('/:teamId/clusters/:teamClusterId/delete-requests'),
    revealCredentials: post<RevealTeamClusterCredentialsInputDTO, RevealTeamClusterCredentialsOutputDTO>(
        '/:teamId/clusters/:teamClusterId/credentials/reveal'
    )
};
