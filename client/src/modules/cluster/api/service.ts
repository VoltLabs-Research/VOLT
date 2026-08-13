import { createService, get, paginated, patch, post } from '@/app/core/http/utils/create-service';
import { emitWithReport } from '@/modules/socket/services/socket-emit-helpers';
import { SOCKET_CLUSTER_METRICS_EVENTS } from '@/modules/socket/events/cluster';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { PageParams, SearchParams, TeamScopedParams } from '@/shared/api/request-params';
import type {
    ClusterTransferJob,
    ClusterTransferJobState,
    ClusterResourceLimitsResponse,
    CreateTeamClusterResponse,
    CreateTeamClusterTransferRequestResponse,
    DeleteTeamClusterResponse,
    RegenerateTeamClusterEnrollmentTokenResponse,
    TeamCluster,
    UpdateTeamClusterQueueConcurrencyResponse,
    UpdateTeamClusterRoleResponse
} from '@volt/contracts/modules/cluster/domain';
import type {
    CreateTeamClusterInput,
    CreateTeamClusterTransferRequestInput,
    DeleteTeamClusterInput,
    UpdateTeamClusterQueueConcurrencyInput,
    UpdateTeamClusterRoleInput
} from '@volt/contracts/modules/cluster/http';

interface TeamClusterScopedParams extends TeamScopedParams{
    teamClusterId: string;
}

export type CreateTeamClusterParams = TeamScopedParams & CreateTeamClusterInput;

export type DeleteTeamClusterParams = TeamClusterScopedParams & DeleteTeamClusterInput;

export type CreateTeamClusterTransferRequestParams = TeamClusterScopedParams & CreateTeamClusterTransferRequestInput;

export type UpdateTeamClusterQueueConcurrencyParams = TeamClusterScopedParams & UpdateTeamClusterQueueConcurrencyInput;

export type UpdateTeamClusterRoleParams = TeamClusterScopedParams & UpdateTeamClusterRoleInput;

export type RegenerateTeamClusterEnrollmentTokenParams = TeamClusterScopedParams;

export type ListTeamClustersParams = TeamScopedParams & PageParams & SearchParams;

export type ListTeamClustersResponse = PaginatedResponse<TeamCluster>;

export interface ListTeamClusterTransferJobsParams extends TeamClusterScopedParams, PageParams{
    state?: ClusterTransferJobState;
}

export type ListTeamClusterTransferJobsResponse = PaginatedResponse<ClusterTransferJob>;

export const requestClusterHistory = async (minutes: number, clusterId: string): Promise<void> => {
    await emitWithReport(SOCKET_CLUSTER_METRICS_EVENTS.METRICS_HISTORY, {
        minutes,
        clusterId
    });
};

const teamClusterEndpoints = {
    create: post<CreateTeamClusterParams, CreateTeamClusterResponse>('/:teamId/clusters'),
    listByTeamId: paginated<ListTeamClustersParams, ListTeamClustersResponse>('/:teamId/clusters'),
    deleteById: post<DeleteTeamClusterParams, DeleteTeamClusterResponse>('/:teamId/clusters/:teamClusterId/delete-requests'),
    getResourceLimits: get<TeamClusterScopedParams, ClusterResourceLimitsResponse>(
        '/:teamId/clusters/:teamClusterId/resource-limits'
    ),
    listTransferJobs: get<ListTeamClusterTransferJobsParams, ListTeamClusterTransferJobsResponse>(
        '/:teamId/clusters/:teamClusterId/transfers'
    ),
    createTransferRequest: post<CreateTeamClusterTransferRequestParams, CreateTeamClusterTransferRequestResponse>(
        '/:teamId/clusters/:teamClusterId/transfers'
    ),
    regenerateEnrollmentToken: post<RegenerateTeamClusterEnrollmentTokenParams, RegenerateTeamClusterEnrollmentTokenResponse>(
        '/:teamId/clusters/:teamClusterId/enrollment-tokens'
    ),
    updateQueueConcurrency: patch<UpdateTeamClusterQueueConcurrencyParams, UpdateTeamClusterQueueConcurrencyResponse>(
        '/:teamId/clusters/:teamClusterId/queue-concurrency'
    ),
    updateRole: patch<UpdateTeamClusterRoleParams, UpdateTeamClusterRoleResponse>(
        '/:teamId/clusters/:teamClusterId/role'
    )
};

export const teamClusterService = createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, teamClusterEndpoints);
