import { createService, download, get, paginated, patch, post, del } from '@/app/core/http/utilities/create-service';
import { emitWithReport } from '@/modules/socket/services/socket-emit-helpers';
import { SOCKET_CLUSTER_METRICS_EVENTS } from '@/modules/socket/events/cluster';
import type { ClusterHistoryMetric } from './entities/cluster-metrics';
import type {
    CreateTeamClusterInputDTO,
    CreateTeamClusterOutputDTO
} from './dtos/team-cluster/create-team-cluster';
import type {
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO
} from './dtos/team-cluster/create-team-cluster-remote-access-session';
import type {
    CreateTeamClusterTransferRequestInputDTO,
    CreateTeamClusterTransferRequestOutputDTO
} from './dtos/team-cluster/create-team-cluster-transfer-request';
import type { DeleteTeamClusterInputDTO, DeleteTeamClusterOutputDTO } from './dtos/team-cluster/delete-team-cluster';
import type { DownloadTeamClusterRemoteExplorerObjectInputDTO } from './dtos/team-cluster/download-team-cluster-remote-explorer-object';
import type {
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO
} from './dtos/team-cluster/get-team-cluster-remote-explorer-node';
import type {
    GetTeamClusterResourceLimitsInputDTO,
    GetTeamClusterResourceLimitsOutputDTO
} from './dtos/team-cluster/get-team-cluster-resource-limits';
import type { ListTeamClustersInputDTO, ListTeamClustersOutputDTO } from './dtos/team-cluster/list-team-clusters';
import type {
    ListTeamClusterRemoteExplorerEntriesInputDTO,
    ListTeamClusterRemoteExplorerEntriesOutputDTO
} from './dtos/team-cluster/list-team-cluster-remote-explorer-entries';
import type {
    ListTeamClusterTransferJobsInputDTO,
    ListTeamClusterTransferJobsOutputDTO
} from './dtos/team-cluster/list-team-cluster-transfer-jobs';
import type {
    RegenerateTeamClusterEnrollmentTokenInputDTO,
    RegenerateTeamClusterEnrollmentTokenOutputDTO
} from './dtos/team-cluster/regenerate-team-cluster-enrollment-token';
import type {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from './dtos/team-cluster/reveal-team-cluster-credentials';
import type {
    UpdateTeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from './dtos/team-cluster/update-team-cluster-queue-concurrency';
import type {
    UpdateTeamClusterRoleInputDTO,
    UpdateTeamClusterRoleOutputDTO
} from './dtos/team-cluster/update-team-cluster-role';
import type {
    ProvisionDemoTeamClusterInputDTO,
    ProvisionDemoTeamClusterOutputDTO,
    GetDemoTeamClusterStatusInputDTO,
    GetDemoTeamClusterStatusOutputDTO,
    DeleteDemoTeamClusterInputDTO,
    DeleteDemoTeamClusterOutputDTO
} from './dtos/team-cluster/demo-team-cluster';

export interface ClusterMetricsHistoryResponse {
    clusterId: string;
    history: ClusterHistoryMetric[];
};

export const requestClusterHistory = async (minutes: number | undefined, clusterId: string): Promise<void> => {
    await emitWithReport(SOCKET_CLUSTER_METRICS_EVENTS.METRICS_HISTORY, {
        minutes: minutes ?? 5,
        clusterId
    });
};

const teamClusterEndpoints = {
    create: post<CreateTeamClusterInputDTO, CreateTeamClusterOutputDTO>('/:teamId/clusters'),
    listByTeamId: paginated<ListTeamClustersInputDTO, ListTeamClustersOutputDTO>('/:teamId/clusters'),
    deleteById: post<DeleteTeamClusterInputDTO, DeleteTeamClusterOutputDTO>('/:teamId/clusters/:teamClusterId/delete-requests'),
    createRemoteAccessSession: post<CreateTeamClusterRemoteAccessSessionInputDTO, CreateTeamClusterRemoteAccessSessionOutputDTO>(
        '/:teamId/clusters/:teamClusterId/remote-access/sessions'
    ),
    getRemoteExplorerNode: post<GetTeamClusterRemoteExplorerNodeInputDTO, GetTeamClusterRemoteExplorerNodeOutputDTO>(
        '/:teamId/clusters/:teamClusterId/remote-access/explorer/node'
    ),
    getResourceLimits: get<GetTeamClusterResourceLimitsInputDTO, GetTeamClusterResourceLimitsOutputDTO>(
        '/:teamId/clusters/:teamClusterId/resource-limits'
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
    ),
    provisionDemo: post<ProvisionDemoTeamClusterInputDTO, ProvisionDemoTeamClusterOutputDTO>(
        '/:teamId/clusters/demo'
    ),
    getDemoStatus: get<GetDemoTeamClusterStatusInputDTO, GetDemoTeamClusterStatusOutputDTO>(
        '/:teamId/clusters/demo/status'
    ),
    deleteDemo: del<DeleteDemoTeamClusterInputDTO, DeleteDemoTeamClusterOutputDTO>(
        '/:teamId/clusters/demo'
    )
};

export const teamClusterService = createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, teamClusterEndpoints);
