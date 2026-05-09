import { teamClusterService } from '@/modules/cluster/api/service';
import { buildKeys, createMutation, createQuery, queryClient, withSuccess } from '@/shared/infrastructure/query';
import type { MutationOptions, QueryOptions } from '@/shared/infrastructure/query';
import type {
    CreateTeamClusterInputDTO,
    CreateTeamClusterOutputDTO,
    CreateTeamClusterTransferRequestInputDTO,
    CreateTeamClusterTransferRequestOutputDTO,
    DeleteTeamClusterInputDTO,
    DeleteTeamClusterOutputDTO,
    ListTeamClustersInputDTO,
    ListTeamClustersOutputDTO,
    ListTeamClusterTransferJobsInputDTO,
    ListTeamClusterTransferJobsOutputDTO,
    ProvisionDemoTeamClusterInputDTO,
    ProvisionDemoTeamClusterOutputDTO,
    RegenerateTeamClusterEnrollmentTokenInputDTO,
    RegenerateTeamClusterEnrollmentTokenOutputDTO,
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO,
    UpdateTeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO,
    UpdateTeamClusterRoleInputDTO,
    UpdateTeamClusterRoleOutputDTO
} from '@/modules/cluster/api/service';
import type { TeamCluster, TeamClusterLifecycleEvent } from '@/modules/cluster/api/entities/team-cluster';

interface TeamClusterQueryKeyMap {
    byTeam: string;
    transferJobs: ListTeamClusterTransferJobsInputDTO;
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

export const teamClustersQuery = createQuery(TEAM_CLUSTER_QUERY_KEYS.byTeam, (teamId: string) => {
    const params: ListTeamClustersInputDTO = {
        teamId,
        page: 1,
        limit: 100
    };

    return teamClusterService.listByTeamId(params);
});

export const useTeamClustersQuery = (teamId: string, options?: QueryOptions<ListTeamClustersOutputDTO>) => {
    return teamClustersQuery(teamId, {
        enabled: Boolean(teamId),
        staleTime: TEAM_CLUSTER_STALE_TIME,
        ...options
    });
};

export const upsertTeamClusterQueryData = (teamId: string, teamCluster: TeamCluster) => {
    queryClient.setQueryData<ListTeamClustersOutputDTO>(TEAM_CLUSTER_QUERY_KEYS.byTeam(teamId), (current) => {
        if (!current) {
            return {
                status: 'success',
                data: [teamCluster],
                pagination: getConsistentClusterPagination(1, 100, 1)
            };
        }

        const exists = current.data.some((cluster) => cluster._id === teamCluster._id);
        const existingCluster = current.data.find((cluster) => cluster._id === teamCluster._id);
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

export const removeTeamClusterQueryData = (teamId: string, teamClusterId: string) => {
    queryClient.setQueryData<ListTeamClustersOutputDTO>(TEAM_CLUSTER_QUERY_KEYS.byTeam(teamId), (current) => {
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

export const applyTeamClusterLifecycleEvent = (event: TeamClusterLifecycleEvent) => {
    if (event.deleted) {
        removeTeamClusterQueryData(event.teamId, event.teamClusterId);
        return;
    }

    if (event.teamCluster) {
        upsertTeamClusterQueryData(event.teamId, event.teamCluster);
    }
};

export const useCreateTeamClusterMutation = (options?: MutationOptions<CreateTeamClusterOutputDTO, CreateTeamClusterInputDTO>) => {
    return createMutation<CreateTeamClusterOutputDTO, CreateTeamClusterInputDTO>(teamClusterService.create)({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
    });
};

export const useRevealTeamClusterCredentialsMutation = (
    options?: MutationOptions<RevealTeamClusterCredentialsOutputDTO, RevealTeamClusterCredentialsInputDTO>
) => {
    return createMutation<RevealTeamClusterCredentialsOutputDTO, RevealTeamClusterCredentialsInputDTO>(
        teamClusterService.revealCredentials
    )(options);
};

export const useDeleteTeamClusterMutation = (options?: MutationOptions<DeleteTeamClusterOutputDTO, DeleteTeamClusterInputDTO>) => {
    return createMutation<DeleteTeamClusterOutputDTO, DeleteTeamClusterInputDTO>(teamClusterService.deleteById)({
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

export const invalidateTeamClusterTransferJobsQuery = () => {
    return queryClient.invalidateQueries({
        queryKey: [...TEAM_CLUSTER_QUERY_KEYS.prefix(), 'transferJobs']
    });
};

export const useTeamClusterTransferJobsQuery = (
    params: ListTeamClusterTransferJobsInputDTO,
    options?: QueryOptions<ListTeamClusterTransferJobsOutputDTO>
) => {
    return transferJobsQuery(params, {
        enabled: Boolean(params.teamId) && Boolean(params.teamClusterId),
        staleTime: 0,
        ...options
    });
};

export const useRegenerateTeamClusterEnrollmentTokenMutation = (
    options?: MutationOptions<RegenerateTeamClusterEnrollmentTokenOutputDTO, RegenerateTeamClusterEnrollmentTokenInputDTO>
) => {
    return createMutation<RegenerateTeamClusterEnrollmentTokenOutputDTO, RegenerateTeamClusterEnrollmentTokenInputDTO>(
        teamClusterService.regenerateEnrollmentToken
    )(options);
};

export const useUpdateTeamClusterQueueConcurrencyMutation = (
    options?: MutationOptions<UpdateTeamClusterQueueConcurrencyOutputDTO, UpdateTeamClusterQueueConcurrencyInputDTO>
) => {
    return createMutation<UpdateTeamClusterQueueConcurrencyOutputDTO, UpdateTeamClusterQueueConcurrencyInputDTO>(
        teamClusterService.updateQueueConcurrency
    )({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
    });
};

export const useUpdateTeamClusterRoleMutation = (
    options?: MutationOptions<UpdateTeamClusterRoleOutputDTO, UpdateTeamClusterRoleInputDTO>
) => {
    return createMutation<UpdateTeamClusterRoleOutputDTO, UpdateTeamClusterRoleInputDTO>(
        teamClusterService.updateRole
    )({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
    });
};

const demoTeamClusterStatusQueryKey = (teamId: string) => ['demo-team-cluster-status', teamId];

const invalidateDemoTeamClusterStatusQuery = (teamId: string) => {
    return queryClient.invalidateQueries({
        queryKey: demoTeamClusterStatusQueryKey(teamId)
    });
};

export const useProvisionDemoTeamClusterMutation = (
    options?: MutationOptions<ProvisionDemoTeamClusterOutputDTO, ProvisionDemoTeamClusterInputDTO>
) => {
    return createMutation<ProvisionDemoTeamClusterOutputDTO, ProvisionDemoTeamClusterInputDTO>(
        teamClusterService.provisionDemo
    )({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
            void invalidateDemoTeamClusterStatusQuery(variables.teamId);
        }, options)
    });
};

export const useCreateTeamClusterTransferRequestMutation = (
    options?: MutationOptions<CreateTeamClusterTransferRequestOutputDTO, CreateTeamClusterTransferRequestInputDTO>
) => {
    return createMutation<CreateTeamClusterTransferRequestOutputDTO, CreateTeamClusterTransferRequestInputDTO>(
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
