import { defineServiceModule } from '@/shared/api/service-module';
import { download, get, paginated, patch, post, del } from '@/app/core/http/utilities/create-service';
import socketService from '@/modules/socket/core/services/socket-service';
import type { ClusterHistoryMetric, ClusterMetrics } from './entities/cluster-metrics';
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

export const CLUSTER_SOCKET_EVENTS = {
    metricsAll: 'metrics:all',
    metricsHistory: 'metrics:history'
};

export const TEAM_CLUSTER_SOCKET_EVENTS = {
    lifecycleUpdated: 'team-cluster.updated',
    subscribe: 'subscribe_to_team_cluster'
};

export interface ClusterMetricsHistoryResponse {
    clusterId: string;
    history: ClusterHistoryMetric[];
};

interface ObserveClusterMetricsHandlers {
    onConnectionChange?: (connected: boolean) => void;
    onMetricsAll?: (clusters: ClusterMetrics[]) => void;
    onMetricsHistory?: (payload: ClusterMetricsHistoryResponse) => void;
};

export const observeClusterMetrics = (handlers: ObserveClusterMetricsHandlers = {}): (() => void) => {
    const cleanups: Array<() => void> = [];

    if (handlers.onConnectionChange) {
        cleanups.push(socketService.onConnectionChange(handlers.onConnectionChange));
    }

    if (handlers.onMetricsAll) {
        cleanups.push(socketService.on(CLUSTER_SOCKET_EVENTS.metricsAll, handlers.onMetricsAll));
    }

    if (handlers.onMetricsHistory) {
        cleanups.push(socketService.on(CLUSTER_SOCKET_EVENTS.metricsHistory, handlers.onMetricsHistory));
    }

    if (handlers.onConnectionChange) {
        handlers.onConnectionChange(socketService.isConnected());
    }

    return () => {
        cleanups.forEach((cleanup) => cleanup());
    };
};

export const requestClusterHistory = async (minutes: number | undefined, clusterId: string): Promise<void> => {
    await socketService.emit(CLUSTER_SOCKET_EVENTS.metricsHistory, {
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

export const teamClusterService = defineServiceModule({
    clients: {
        default: {
            basePath: '/teams'
        }
    },
    endpoints: teamClusterEndpoints
});
