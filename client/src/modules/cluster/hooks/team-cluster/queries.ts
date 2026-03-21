import { teamClusterService } from '@/modules/cluster/api/service/team-cluster';
import { buildKeys, createMutation, createQuery, queryClient, withSuccess } from '@/shared/infrastructure/query';
import type { MutationOptions, QueryOptions } from '@/shared/infrastructure/query';
import type { CreateTeamClusterInputDTO, CreateTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/create-team-cluster';
import type { DeleteTeamClusterInputDTO, DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type {
    FetchAvailableClusterVersionsInputDTO,
    FetchAvailableClusterVersionsOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/fetch-available-cluster-versions';
import type { ListTeamClustersInputDTO, ListTeamClustersOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/list-team-clusters';
import type {
    RequestClusterUpdateInputDTO,
    RequestClusterUpdateOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';
import type {
    RegenerateTeamClusterEnrollmentTokenInputDTO,
    RegenerateTeamClusterEnrollmentTokenOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/regenerate-team-cluster-enrollment-token';
import type {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/reveal-team-cluster-credentials';
import type {
    UpdateTeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-queue-concurrency';
import type { TeamCluster, TeamClusterLifecycleEvent } from '@/modules/cluster/api/entities/team-cluster';

interface TeamClusterQueryKeyMap {
    byTeam: string;
    availableVersions: FetchAvailableClusterVersionsInputDTO;
};

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

        const total = exists ? current.pagination.total : current.pagination.total + 1;

        return {
            ...current,
            data: exists
                ? current.data.map((cluster) => cluster._id === teamCluster._id ? teamCluster : cluster)
                : [teamCluster, ...current.data],
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

export const invalidateAvailableVersionsQuery = (teamId: string, teamClusterId: string) => {
    return queryClient.invalidateQueries({
        queryKey: TEAM_CLUSTER_QUERY_KEYS.availableVersions({ teamId, teamClusterId })
    });
};

const availableVersionsQuery = createQuery(
    TEAM_CLUSTER_QUERY_KEYS.availableVersions,
    teamClusterService.fetchAvailableVersions
);

export const useAvailableClusterVersionsQuery = (
    teamId: string,
    teamClusterId: string,
    options?: QueryOptions<FetchAvailableClusterVersionsOutputDTO>
) => {
    return availableVersionsQuery(
        { teamId, teamClusterId },
        {
            staleTime: 0,
            ...options
        }
    );
};

export const useRequestClusterUpdateMutation = (
    options?: MutationOptions<RequestClusterUpdateOutputDTO, RequestClusterUpdateInputDTO>
) => {
    return createMutation<RequestClusterUpdateOutputDTO, RequestClusterUpdateInputDTO>(teamClusterService.requestUpdate)({
        ...options,
        onSuccess: withSuccess((data, variables) => {
            upsertTeamClusterQueryData(variables.teamId, data.teamCluster);
        }, options)
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
