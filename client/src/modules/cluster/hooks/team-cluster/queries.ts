import { teamClusterService } from '@/modules/cluster/api/service';
import { buildKeys, createMutation, createQuery, queryClient, withSuccess } from '@/shared/query';
import type { MutationOptions, QueryOptions } from '@/shared/query';
import type {
    CreateTeamClusterParams,
    CreateTeamClusterTransferRequestParams,
    DeleteDemoTeamClusterParams,
    DeleteTeamClusterParams,
    ListTeamClusterTransferJobsParams,
    ListTeamClusterTransferJobsResponse,
    ListTeamClustersParams,
    ListTeamClustersResponse,
    ProvisionDemoTeamClusterParams,
    RegenerateTeamClusterEnrollmentTokenParams,
    RevealTeamClusterCredentialsParams,
    UpdateTeamClusterQueueConcurrencyParams,
    UpdateTeamClusterRoleParams
} from '@/modules/cluster/api/service';
import type { CreateTeamClusterResponse, CreateTeamClusterTransferRequestResponse, DeleteDemoTeamClusterResponse, DeleteTeamClusterResponse, ProvisionDemoTeamClusterResponse, RegenerateTeamClusterEnrollmentTokenResponse, RevealTeamClusterCredentialsResponse, UpdateTeamClusterQueueConcurrencyResponse, UpdateTeamClusterRoleResponse } from '@volt/contracts/modules/cluster/domain';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import type { TeamCluster, TeamClusterLifecycleEvent } from '@volt/contracts/modules/cluster/domain';

interface TeamClusterQueryKeyMap {
    byTeam: string;
    transferJobs: ListTeamClusterTransferJobsParams;
}

const TEAM_CLUSTER_STALE_TIME = 5 * 60 * 1000;

const getConsistentClusterPagination = (page: number, limit: number, total: number) => {
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
    };
};

export const TEAM_CLUSTER_QUERY_KEYS = buildKeys<TeamClusterQueryKeyMap>('team-clusters');

const mergeTeamClusterTransferState = (current: TeamCluster | undefined, incoming: TeamCluster): TeamCluster => {
    if (incoming.activeTransfers !== undefined) {
        return incoming;
    }

    if (!current?.activeTransfers) {
        return incoming;
    }

    return {
        ...incoming,
        activeTransfers: current.activeTransfers
    };
};

const teamClustersQuery = createQuery(TEAM_CLUSTER_QUERY_KEYS.byTeam, (teamId: string) => {
    const params: ListTeamClustersParams = {
        teamId,
        page: 1,
        limit: 100
    };

    return teamClusterService.listByTeamId(params);
});

export const useTeamClustersQuery = (teamId: string, options?: QueryOptions<ListTeamClustersResponse>) => {
    return teamClustersQuery(teamId, {
        enabled: Boolean(teamId),
        staleTime: TEAM_CLUSTER_STALE_TIME,
        ...options
    });
};

const invalidateTeamClustersQuery = (teamId: string) => {
    return queryClient.invalidateQueries({
        queryKey: TEAM_CLUSTER_QUERY_KEYS.byTeam(teamId)
    });
};

const upsertTeamClusterQueryData = (teamId: string, teamCluster: TeamCluster) => {
    queryClient.setQueryData<ListTeamClustersResponse>(TEAM_CLUSTER_QUERY_KEYS.byTeam(teamId), (current) => {
        if (!current) {
            return {
                status: 'success',
                data: [teamCluster],
                pagination: getConsistentClusterPagination(1, 100, 1)
            };
        }

        const existingCluster = current.data.find((cluster) => cluster._id === teamCluster._id);
        const exists = Boolean(existingCluster);
        const mergedTeamCluster = mergeTeamClusterTransferState(existingCluster, teamCluster);

        const total = exists ? current.pagination.total : current.pagination.total + 1;

        return {
            ...current,
            data: exists
                ? current.data.map((cluster) => cluster._id === teamCluster._id ? mergedTeamCluster : cluster)
                : [mergedTeamCluster, ...current.data],
            pagination: getConsistentClusterPagination(current.pagination.page, current.pagination.limit, total)
        };
    });
};

const removeTeamClusterQueryData = (teamId: string, teamClusterId: string) => {
    queryClient.setQueryData<ListTeamClustersResponse>(TEAM_CLUSTER_QUERY_KEYS.byTeam(teamId), (current) => {
        if (!current) {
            return current;
        }

        const nextData = current.data.filter((cluster) => cluster._id !== teamClusterId);
        const wasRemoved = nextData.length !== current.data.length;
        const total = wasRemoved ? Math.max(0, current.pagination.total - 1) : current.pagination.total;

        return {
            ...current,
            data: nextData,
            pagination: getConsistentClusterPagination(current.pagination.page, current.pagination.limit, total)
        };
    });
};

const markDemoTeamClusterDeletingQueryData = (teamId: string) => {
    queryClient.setQueryData<ListTeamClustersResponse>(TEAM_CLUSTER_QUERY_KEYS.byTeam(teamId), (current) => {
        if (!current) {
            return current;
        }

        return {
            ...current,
            data: current.data.map((cluster) => cluster.isDemo
                ? {
                    ...cluster,
                    status: TeamClusterStatus.Deleting
                }
                : cluster)
        };
    });
};

export const applyTeamClusterLifecycleEvent = (event: TeamClusterLifecycleEvent) => {
    if (event.deleted) {
        removeTeamClusterQueryData(event.teamId, event.teamClusterId);
        return;
    }

    if (event.teamCluster) {
        upsertTeamClusterQueryData(event.teamId, event.teamCluster);
    }
};

export const useCreateTeamClusterMutation = (options?: MutationOptions<CreateTeamClusterResponse, CreateTeamClusterParams>) => {
    return createMutation<CreateTeamClusterResponse, CreateTeamClusterParams>(teamClusterService.create)({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
    });
};

export const useRevealTeamClusterCredentialsMutation = (
    options?: MutationOptions<RevealTeamClusterCredentialsResponse, RevealTeamClusterCredentialsParams>
) => {
    return createMutation<RevealTeamClusterCredentialsResponse, RevealTeamClusterCredentialsParams>(
        teamClusterService.revealCredentials
    )(options);
};

export const useDeleteTeamClusterMutation = (options?: MutationOptions<DeleteTeamClusterResponse, DeleteTeamClusterParams>) => {
    return createMutation<DeleteTeamClusterResponse, DeleteTeamClusterParams>(teamClusterService.deleteById)({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            if (data.deleted) {
                removeTeamClusterQueryData(variables.teamId, variables.teamClusterId);
                return;
            }

            if (data.teamCluster) {
                upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
            }
        }, options)
    });
};

const transferJobsQuery = createQuery(
    TEAM_CLUSTER_QUERY_KEYS.transferJobs,
    teamClusterService.listTransferJobs
);

const invalidateTeamClusterTransferJobsQuery = () => {
    return queryClient.invalidateQueries({
        queryKey: [...TEAM_CLUSTER_QUERY_KEYS.prefix(), 'transferJobs']
    });
};

export const useTeamClusterTransferJobsQuery = (
    params: ListTeamClusterTransferJobsParams,
    options?: QueryOptions<ListTeamClusterTransferJobsResponse>
) => {
    return transferJobsQuery(params, {
        enabled: Boolean(params.teamId) && Boolean(params.teamClusterId),
        staleTime: 0,
        ...options
    });
};

export const useRegenerateTeamClusterEnrollmentTokenMutation = (
    options?: MutationOptions<RegenerateTeamClusterEnrollmentTokenResponse, RegenerateTeamClusterEnrollmentTokenParams>
) => {
    return createMutation<RegenerateTeamClusterEnrollmentTokenResponse, RegenerateTeamClusterEnrollmentTokenParams>(
        teamClusterService.regenerateEnrollmentToken
    )(options);
};

export const useUpdateTeamClusterQueueConcurrencyMutation = (
    options?: MutationOptions<UpdateTeamClusterQueueConcurrencyResponse, UpdateTeamClusterQueueConcurrencyParams>
) => {
    return createMutation<UpdateTeamClusterQueueConcurrencyResponse, UpdateTeamClusterQueueConcurrencyParams>(
        teamClusterService.updateQueueConcurrency
    )({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
    });
};

export const useUpdateTeamClusterRoleMutation = (
    options?: MutationOptions<UpdateTeamClusterRoleResponse, UpdateTeamClusterRoleParams>
) => {
    return createMutation<UpdateTeamClusterRoleResponse, UpdateTeamClusterRoleParams>(
        teamClusterService.updateRole
    )({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
    });
};

export const useProvisionDemoTeamClusterMutation = (
    options?: MutationOptions<ProvisionDemoTeamClusterResponse, ProvisionDemoTeamClusterParams>
) => {
    return createMutation<ProvisionDemoTeamClusterResponse, ProvisionDemoTeamClusterParams>(
        teamClusterService.provisionDemo
    )({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
    });
};

export const useDeleteDemoTeamClusterMutation = (
    options?: MutationOptions<DeleteDemoTeamClusterResponse, DeleteDemoTeamClusterParams>
) => {
    return createMutation<DeleteDemoTeamClusterResponse, DeleteDemoTeamClusterParams>(
        teamClusterService.deleteDemo
    )({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            if (data.teardownScheduled) {
                markDemoTeamClusterDeletingQueryData(variables.teamId);
            }

            void invalidateTeamClustersQuery(variables.teamId);
        }, options)
    });
};

export const useCreateTeamClusterTransferRequestMutation = (
    options?: MutationOptions<CreateTeamClusterTransferRequestResponse, CreateTeamClusterTransferRequestParams>
) => {
    return createMutation<CreateTeamClusterTransferRequestResponse, CreateTeamClusterTransferRequestParams>(
        teamClusterService.createTransferRequest
    )({
        ...options,
        onSuccess: withSuccess((_, variables) => {
            void invalidateTeamClusterTransferJobsQuery();
            void queryClient.invalidateQueries({
                queryKey: TEAM_CLUSTER_QUERY_KEYS.byTeam(variables.teamId)
            });
        }, options)
    });
};
