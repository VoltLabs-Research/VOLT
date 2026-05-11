import { createService, del, download, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import { emitWithReport } from '@/modules/socket/services/socket-emit-helpers';
import { SOCKET_CLUSTER_METRICS_EVENTS } from '@/modules/socket/events/cluster';
import type { ClusterResourceLimits } from '@/modules/container/api/entities/cluster-resource-limits';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { TeamCluster, TeamClusterCredentialServices, TeamClusterRole } from './entities/team-cluster';
import type {
    TeamClusterRemoteAccessSession,
    TeamClusterRemoteAccessTarget,
    TeamClusterRemoteExplorerEntry,
    TeamClusterRemoteExplorerNode
} from './entities/team-cluster-remote-access';
import type { ClusterTransferJob, ClusterTransferJobState } from './entities/team-cluster-transfer';

export interface CreateTeamClusterInputDTO {
    teamId: string;
    name: string;
}

export interface CreateTeamClusterOutputDTO {
    teamCluster: TeamCluster;
    enrollmentToken: string;
}

export interface CreateTeamClusterRemoteAccessSessionInputDTO {
    teamId: string;
    teamClusterId: string;
    password: string;
    target: TeamClusterRemoteAccessTarget;
}

export interface CreateTeamClusterRemoteAccessSessionOutputDTO {
    session: TeamClusterRemoteAccessSession;
}

export interface CreateTeamClusterTransferRequestInputDTO {
    teamId: string;
    teamClusterId: string;
    destinationClusterId: string;
}

export interface CreateTeamClusterTransferRequestOutputDTO {
    message: string;
    sourceClusterId: string;
    destinationClusterId: string;
    requestedJobs: ClusterTransferJob[];
}

export interface DeleteTeamClusterInputDTO {
    teamId: string;
    teamClusterId: string;
    password: string;
}

export interface DeleteTeamClusterOutputDTO {
    success: boolean;
    deleted: boolean;
    manualUninstallRequired: boolean;
    message: string;
    manualUninstallCommand?: string;
    teamCluster?: TeamCluster;
}

export interface DeleteDemoTeamClusterInputDTO {
    teamId: string;
}

export interface DeleteDemoTeamClusterOutputDTO {
    teardownScheduled: boolean;
}

export interface DownloadTeamClusterRemoteExplorerObjectInputDTO {
    teamId: string;
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

export interface GetTeamClusterRemoteExplorerNodeInputDTO {
    teamId: string;
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

export interface GetTeamClusterRemoteExplorerNodeOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    node: TeamClusterRemoteExplorerNode;
}

export interface GetTeamClusterResourceLimitsInputDTO {
    teamId: string;
    teamClusterId: string;
}

export interface GetTeamClusterResourceLimitsOutputDTO {
    resourceLimits: ClusterResourceLimits;
}

export interface ListTeamClustersInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export type ListTeamClustersOutputDTO = PaginatedResponse<TeamCluster>;

export interface ListTeamClusterRemoteExplorerEntriesInputDTO {
    teamId: string;
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

export interface ListTeamClusterRemoteExplorerEntriesOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
    entries: TeamClusterRemoteExplorerEntry[];
}

export interface ListTeamClusterTransferJobsInputDTO {
    teamId: string;
    teamClusterId: string;
    page?: number;
    limit?: number;
    state?: ClusterTransferJobState;
}

export type ListTeamClusterTransferJobsOutputDTO = PaginatedResponse<ClusterTransferJob>;

export interface RegenerateTeamClusterEnrollmentTokenInputDTO {
    teamId: string;
    teamClusterId: string;
}

export interface RegenerateTeamClusterEnrollmentTokenOutputDTO {
    enrollmentToken: string;
}

export interface RevealTeamClusterCredentialsInputDTO {
    teamId: string;
    teamClusterId: string;
    password: string;
}

export interface RevealTeamClusterCredentialsOutputDTO {
    teamClusterId: string;
    services: TeamClusterCredentialServices;
}

export interface TeamClusterQueueConcurrencyInputDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    sshImport: number;
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimitInputDTO {
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimitsInputDTO {
    analysisProcessing: TeamClusterQueueScopeLimitInputDTO;
    artifactUpload: TeamClusterQueueScopeLimitInputDTO;
    trajectoryRasterization: TeamClusterQueueScopeLimitInputDTO;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitInputDTO;
}

export interface UpdateTeamClusterQueueConcurrencyInputDTO {
    teamId: string;
    teamClusterId: string;
    queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
    queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
}

export interface UpdateTeamClusterQueueConcurrencyOutputDTO {
    message: string;
    restartRequested: boolean;
    teamCluster: TeamCluster;
}

export interface UpdateTeamClusterRoleInputDTO {
    teamId: string;
    teamClusterId: string;
    role: TeamClusterRole;
}

export interface UpdateTeamClusterRoleOutputDTO {
    message: string;
    teamCluster: TeamCluster;
}

export interface ProvisionDemoTeamClusterInputDTO {
    teamId: string;
}

export interface ProvisionDemoTeamClusterOutputDTO {
    teamCluster: TeamCluster;
}

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
