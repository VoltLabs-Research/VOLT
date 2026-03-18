import teamService from '../../api/services/team';
import { buildKeys, createCachePolicy } from '@/shared/infrastructure/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Team } from '../../api/entities/team/team';
import type { CreateTeamInputDTO } from '../../api/dtos/team/create-team';
import type { UpdateTeamInputDTO } from '../../api/dtos/team/update-team';
import type { DeleteTeamInputDTO } from '../../api/dtos/team/delete-team';
import type { LeaveTeamInputDTO } from '../../api/dtos/team/leave-team';
import type { GenerateInviteCodeInputDTO } from '../../api/dtos/team/generate-invite-code';
import type { DeleteInviteCodeInputDTO } from '../../api/dtos/team/delete-invite-code';
import type { JoinByInviteCodeInputDTO, JoinByInviteCodeOutputDTO } from '../../api/dtos/team/join-by-invite-code';
import type {
    PreviewJoinByInviteCodeInputDTO,
    PreviewJoinByInviteCodeOutputDTO
} from '../../api/dtos/team/preview-join-by-invite-code';
import queryClient from '@/shared/infrastructure/query/query-client';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

/** Team query keys. */

const teamKeys = buildKeys<{
    teams: void;
}>('teams');

const permissionKeys = buildKeys<{
    permissions: void;
    teamPermissions: string;
}>('team-permissions');

export const TEAM_QUERY_KEYS = {
    teams: teamKeys.teams,
    permissions: permissionKeys.permissions,
    teamPermissions: permissionKeys.teamPermissions,
    joinByCodePreview: (code: string) => ['team-join-by-code-preview', code] as const
};

registerPreservedQueryKey(TEAM_QUERY_KEYS.teams()[0] as string);

/** Team-scoped query roots used for bulk cache cleanup. */

const TEAM_SCOPED_QUERY_ROOTS = new Set<string>([
    'team-permissions',
    'team-roles',
    'team-members',
    'team-invitations',
    'secret-keys',
    'secret-key-usage',
    'secret-key-team-metrics',
    'team-ai-integrations',
    'team-ai-integration-models'
]);

interface TeamScopedValue {
    teamId?: unknown;
};

const hasTeamScopedValue = (value: unknown): value is TeamScopedValue => {
    return typeof value === 'object' && value !== null && 'teamId' in value;
};

const extractTeamId = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    if (hasTeamScopedValue(value)) {
        const teamId = value.teamId;
        return typeof teamId === 'string' ? teamId : null;
    }
    return null;
};

const getQueryTeamId = (queryKey: readonly unknown[]): string | null => {
    for (let i = 2; i < queryKey.length; i++) {
        const result = extractTeamId(queryKey[i]);
        if (result) return result;
    }
    return extractTeamId(queryKey[1]);
};

const matchesTeamScopedQuery = (queryKey: readonly unknown[], teamId: string) => {
    const root = queryKey[0];
    if (typeof root !== 'string' || !TEAM_SCOPED_QUERY_ROOTS.has(root)) return false;
    return getQueryTeamId(queryKey) === teamId;
};

/** Team cache helpers. */

const teamsCache = createCachePolicy<void>(TEAM_QUERY_KEYS.teams);

const setTeamsQueryData = (updater: (previous?: Team[]) => Team[] | undefined) => {
    teamsCache.set<Team[]>(undefined, updater);
};

export const invalidateTeamsQuery = () => teamsCache.invalidate(undefined);

const invalidateTeamScopedQueries = (teamId: string) => {
    return queryClient.invalidateQueries({
        predicate: (query) => matchesTeamScopedQuery(query.queryKey, teamId)
    });
};

const removeTeamScopedQueries = (teamId: string) => {
    queryClient.removeQueries({
        predicate: (query) => matchesTeamScopedQuery(query.queryKey, teamId)
    });
};

/** Team queries. */

export const useTeamsQuery = (_params?: void, options?: QueryOptions<Team[]>) => {
    return useQuery({
        queryKey: TEAM_QUERY_KEYS.teams(),
        queryFn: () => teamService.getAll({}),
        ...options
    });
};

export const useTeamPermissionsQuery = (teamId: string, options?: QueryOptions<string[]>) => {
    return useQuery({
        queryKey: TEAM_QUERY_KEYS.teamPermissions(teamId),
        queryFn: () => teamService.getMyPermissions({ teamId }),
        ...options
    });
};

export const usePreviewJoinByCodeQuery = (
    params: PreviewJoinByInviteCodeInputDTO,
    options?: QueryOptions<PreviewJoinByInviteCodeOutputDTO>
) => {
    return useQuery({
        queryKey: TEAM_QUERY_KEYS.joinByCodePreview(params.code),
        queryFn: () => teamService.previewJoinByCode(params),
        ...options
    });
};

/** Team mutations. */

export const useCreateTeamMutation = () => {
    return useMutation<Team, Error, CreateTeamInputDTO>({
        mutationFn: teamService.create,
        onSuccess: (newTeam) => {
            setTeamsQueryData((previous) => {
                if (!previous) return [newTeam];
                return [newTeam, ...previous];
            });
        }
    });
};

export const useUpdateTeamMutation = () => {
    return useMutation<Team, Error, UpdateTeamInputDTO>({
        mutationFn: teamService.update,
        onSuccess: (updatedTeam) => {
            setTeamsQueryData((previous) => {
                if (!previous) return previous;
                return previous.map((team) => team._id === updatedTeam._id ? updatedTeam : team);
            });
        }
    });
};

export const useDeleteTeamMutation = () => {
    return useMutation<void, Error, DeleteTeamInputDTO>({
        mutationFn: teamService.delete,
        onSuccess: (_data, { teamId }) => {
            setTeamsQueryData((previous) => {
                if (!previous) return previous;
                return previous.filter((team) => team._id !== teamId);
            });
            invalidateTeamScopedQueries(teamId);
        }
    });
};

export const useLeaveTeamMutation = () => {
    return useMutation<void, Error, LeaveTeamInputDTO, { previousTeams?: Team[] }>({
        mutationFn: teamService.leave,
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: TEAM_QUERY_KEYS.teams() });

            const previousTeams = queryClient.getQueryData<Team[]>(TEAM_QUERY_KEYS.teams());

            setTeamsQueryData((previous) => {
                if (!previous) return previous;
                return previous.filter((team) => team._id !== variables.teamId);
            });

            return { previousTeams };
        },
        onError: (_error, _variables, context) => {
            if (context?.previousTeams) {
                teamsCache.restore(undefined, context.previousTeams);
            }
        },
        onSuccess: (_data, variables) => {
            removeTeamScopedQueries(variables.teamId);

            window.setTimeout(() => {
                invalidateTeamsQuery();
            }, 1500);
        }
    });
};

export const useGenerateInviteCodeMutation = () => {
    return useMutation<Team, Error, GenerateInviteCodeInputDTO>({
        mutationFn: teamService.generateInviteCode,
        onSuccess: (updatedTeam) => {
            setTeamsQueryData((previous) => {
                if (!previous) return previous;
                return previous.map((team) => team._id === updatedTeam._id ? updatedTeam : team);
            });
        }
    });
};

export const useDeleteInviteCodeMutation = () => {
    return useMutation<void, Error, DeleteInviteCodeInputDTO>({
        mutationFn: teamService.deleteInviteCode,
        onSuccess: (_data, variables) => {
            setTeamsQueryData((previous) => {
                if (!previous) return previous;
                return previous.map((team) => {
                    if (team._id !== variables.teamId) return team;
                    return { ...team, inviteCode: undefined };
                });
            });
        }
    });
};

export const useJoinByCodeMutation = () => {
    return useMutation<JoinByInviteCodeOutputDTO, Error, JoinByInviteCodeInputDTO>({
        mutationFn: teamService.joinByCode,
        onSuccess: () => {
            invalidateTeamsQuery();
        }
    });
};
