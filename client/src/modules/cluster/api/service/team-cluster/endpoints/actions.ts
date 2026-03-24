import { download, get, patch, post } from '@/app/core/http/utilities/create-service';
import type {
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/create-team-cluster-remote-access-session';
import type {
    CreateTeamClusterTransferRequestInputDTO,
    CreateTeamClusterTransferRequestOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/create-team-cluster-transfer-request';
import type { DownloadTeamClusterRemoteExplorerObjectInputDTO } from '@/modules/cluster/api/dtos/team-cluster/download-team-cluster-remote-explorer-object';
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
    ListTeamClusterTransferJobsInputDTO,
    ListTeamClusterTransferJobsOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/list-team-cluster-transfer-jobs';
import type {
    RegenerateTeamClusterEnrollmentTokenInputDTO,
    RegenerateTeamClusterEnrollmentTokenOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/regenerate-team-cluster-enrollment-token';
import type {
    RequestClusterUpdateInputDTO,
    RequestClusterUpdateOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';
import type {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/reveal-team-cluster-credentials';
import type {
    UpdateTeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-queue-concurrency';
import type {
    UpdateTeamClusterRoleInputDTO,
    UpdateTeamClusterRoleOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-role';

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
    ),
    listTransferJobs: get<ListTeamClusterTransferJobsInputDTO, ListTeamClusterTransferJobsOutputDTO>(
        '/:teamId/clusters/:teamClusterId/transfers'
    ),
    createTransferRequest: post<CreateTeamClusterTransferRequestInputDTO, CreateTeamClusterTransferRequestOutputDTO>(
        '/:teamId/clusters/:teamClusterId/transfers'
    ),
    downloadRemoteExplorerObject: download<DownloadTeamClusterRemoteExplorerObjectInputDTO>(
        'POST', '/:teamId/clusters/:teamClusterId/remote-access/explorer/download'
    ),
    regenerateEnrollmentToken: post<RegenerateTeamClusterEnrollmentTokenInputDTO, RegenerateTeamClusterEnrollmentTokenOutputDTO>(
        '/:teamId/clusters/:teamClusterId/enrollment-token/regenerate'
    ),
    updateQueueConcurrency: patch<UpdateTeamClusterQueueConcurrencyInputDTO, UpdateTeamClusterQueueConcurrencyOutputDTO>(
        '/:teamId/clusters/:teamClusterId/queue-concurrency'
    ),
    updateRole: patch<UpdateTeamClusterRoleInputDTO, UpdateTeamClusterRoleOutputDTO>(
        '/:teamId/clusters/:teamClusterId/role'
    )
};
