import { createService, del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import { emitWithReport } from '@/modules/socket/services/socket-emit-helpers';
import { SOCKET_CLUSTER_METRICS_EVENTS } from '@/modules/socket/events/cluster';
import type { ClusterResourceLimits } from '@/modules/container/api/types/cluster-resource-limits';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { TeamCluster, TeamClusterCredentialServices, TeamClusterRole } from './types/team-cluster';
import type { ClusterTransferJob, ClusterTransferJobState } from './types/team-cluster-transfer';

export interface CreateTeamClusterInput {
    teamId: string;
    name: string;
}

export interface CreateTeamClusterResponse {
    teamCluster: TeamCluster;
    enrollmentToken: string;
}

export interface CreateTeamClusterTransferRequestInput {
    teamId: string;
    teamClusterId: string;
    destinationClusterId: string;
}

export interface CreateTeamClusterTransferRequestResponse {
    message: string;
    sourceClusterId: string;
    destinationClusterId: string;
    requestedJobs: ClusterTransferJob[];
}

export interface DeleteTeamClusterInput {
    teamId: string;
    teamClusterId: string;
    password: string;
}

export interface DeleteTeamClusterResponse {
    success: boolean;
    deleted: boolean;
    manualUninstallRequired: boolean;
    message: string;
    manualUninstallCommand?: string;
    teamCluster?: TeamCluster;
}

export interface DeleteDemoTeamClusterInput {
    teamId: string;
}

export interface DeleteDemoTeamClusterResponse {
    teardownScheduled: boolean;
}

export interface GetTeamClusterResourceLimitsInput {
    teamId: string;
    teamClusterId: string;
}

export interface GetTeamClusterResourceLimitsResponse {
    resourceLimits: ClusterResourceLimits;
}

export interface ListTeamClustersInput {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export type ListTeamClustersResponse = PaginatedResponse<TeamCluster>;

export interface ListTeamClusterTransferJobsInput {
    teamId: string;
    teamClusterId: string;
    page?: number;
    limit?: number;
    state?: ClusterTransferJobState;
}

export type ListTeamClusterTransferJobsResponse = PaginatedResponse<ClusterTransferJob>;

export interface RegenerateTeamClusterEnrollmentTokenInput {
    teamId: string;
    teamClusterId: string;
}

export interface RegenerateTeamClusterEnrollmentTokenResponse {
    enrollmentToken: string;
}

export interface RevealTeamClusterCredentialsInput {
    teamId: string;
    teamClusterId: string;
    password: string;
}

export interface RevealTeamClusterCredentialsResponse {
    teamClusterId: string;
    services: TeamClusterCredentialServices;
}

export interface TeamClusterQueueConcurrencyInput {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimitInput {
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimitsInput {
    analysisProcessing: TeamClusterQueueScopeLimitInput;
    artifactUpload: TeamClusterQueueScopeLimitInput;
    trajectoryRasterization: TeamClusterQueueScopeLimitInput;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitInput;
}

export interface UpdateTeamClusterQueueConcurrencyInput {
    teamId: string;
    teamClusterId: string;
    queueConcurrency: TeamClusterQueueConcurrencyInput;
    queueScopeLimits: TeamClusterQueueScopeLimitsInput;
}

export interface UpdateTeamClusterQueueConcurrencyResponse {
    message: string;
    restartRequested: boolean;
    teamCluster: TeamCluster;
}

export interface UpdateTeamClusterRoleInput {
    teamId: string;
    teamClusterId: string;
    role: TeamClusterRole;
}

export interface UpdateTeamClusterRoleResponse {
    message: string;
    teamCluster: TeamCluster;
}

export interface ProvisionDemoTeamClusterInput {
    teamId: string;
}

export interface ProvisionDemoTeamClusterResponse {
    teamCluster: TeamCluster;
}

export const requestClusterHistory = async (minutes: number | undefined, clusterId: string): Promise<void> => {
    await emitWithReport(SOCKET_CLUSTER_METRICS_EVENTS.METRICS_HISTORY, {
        minutes: minutes ?? 5,
        clusterId
    });
};

const teamClusterEndpoints = {
    create: post<CreateTeamClusterInput, CreateTeamClusterResponse>('/:teamId/clusters'),
    listByTeamId: paginated<ListTeamClustersInput, ListTeamClustersResponse>('/:teamId/clusters'),
    deleteById: post<DeleteTeamClusterInput, DeleteTeamClusterResponse>('/:teamId/clusters/:teamClusterId/delete-requests'),
    getResourceLimits: get<GetTeamClusterResourceLimitsInput, GetTeamClusterResourceLimitsResponse>(
        '/:teamId/clusters/:teamClusterId/resource-limits'
    ),
    revealCredentials: post<RevealTeamClusterCredentialsInput, RevealTeamClusterCredentialsResponse>(
        '/:teamId/clusters/:teamClusterId/credentials/reveal'
    ),
    listTransferJobs: get<ListTeamClusterTransferJobsInput, ListTeamClusterTransferJobsResponse>(
        '/:teamId/clusters/:teamClusterId/transfers'
    ),
    createTransferRequest: post<CreateTeamClusterTransferRequestInput, CreateTeamClusterTransferRequestResponse>(
        '/:teamId/clusters/:teamClusterId/transfers'
    ),
    regenerateEnrollmentToken: post<RegenerateTeamClusterEnrollmentTokenInput, RegenerateTeamClusterEnrollmentTokenResponse>(
        '/:teamId/clusters/:teamClusterId/enrollment-token/regenerate'
    ),
    updateQueueConcurrency: patch<UpdateTeamClusterQueueConcurrencyInput, UpdateTeamClusterQueueConcurrencyResponse>(
        '/:teamId/clusters/:teamClusterId/queue-concurrency'
    ),
    updateRole: patch<UpdateTeamClusterRoleInput, UpdateTeamClusterRoleResponse>(
        '/:teamId/clusters/:teamClusterId/role'
    ),
    provisionDemo: post<ProvisionDemoTeamClusterInput, ProvisionDemoTeamClusterResponse>(
        '/:teamId/clusters/demo'
    ),
    deleteDemo: del<DeleteDemoTeamClusterInput, DeleteDemoTeamClusterResponse>(
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
