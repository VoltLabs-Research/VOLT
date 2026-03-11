import { get, post } from '@/app/core/http/utilities/create-service';
import type {
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/create-team-cluster-remote-access-session';
import type { DeleteTeamClusterInputDTO, DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type {
    FetchAvailableClusterVersionsInputDTO,
    FetchAvailableClusterVersionsOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/fetch-available-cluster-versions';
import type {
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/get-team-cluster-remote-explorer-node';
import type {
    ListTeamClusterRemoteExplorerEntriesInputDTO,
    ListTeamClusterRemoteExplorerEntriesOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/list-team-cluster-remote-explorer-entries';
import type {
    RequestClusterUpdateInputDTO,
    RequestClusterUpdateOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';
import type {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/reveal-team-cluster-credentials';

export default {
    deleteById: post<DeleteTeamClusterInputDTO, DeleteTeamClusterOutputDTO>('/:teamId/clusters/:teamClusterId/delete-requests'),
    requestUpdate: post<RequestClusterUpdateInputDTO, RequestClusterUpdateOutputDTO>('/:teamId/clusters/:teamClusterId/update-requests'),
    fetchAvailableVersions: get<FetchAvailableClusterVersionsInputDTO, FetchAvailableClusterVersionsOutputDTO>(
        '/:teamId/clusters/:teamClusterId/available-updates'
    ),
    createRemoteAccessSession: post<CreateTeamClusterRemoteAccessSessionInputDTO, CreateTeamClusterRemoteAccessSessionOutputDTO>(
        '/:teamId/clusters/:teamClusterId/remote-access/sessions'
    ),
    getRemoteExplorerNode: post<GetTeamClusterRemoteExplorerNodeInputDTO, GetTeamClusterRemoteExplorerNodeOutputDTO>(
        '/:teamId/clusters/:teamClusterId/remote-access/explorer/node'
    ),
    listRemoteExplorerEntries: post<ListTeamClusterRemoteExplorerEntriesInputDTO, ListTeamClusterRemoteExplorerEntriesOutputDTO>(
        '/:teamId/clusters/:teamClusterId/remote-access/explorer/entries'
    ),
    revealCredentials: post<RevealTeamClusterCredentialsInputDTO, RevealTeamClusterCredentialsOutputDTO>(
        '/:teamId/clusters/:teamClusterId/credentials/reveal'
    )
};
