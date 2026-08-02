import teamService from '../../api/services/team-service';
import {
    buildKeys,
    createMutation,
    createInvalidatingMutation,
    createQuery,
    queryClient
} from '@/shared/query';
import type { QueryOptions } from '@/shared/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import { useMutation } from '@tanstack/react-query';
import type { Team } from '@volt/contracts/modules/team/domain';
import type { JoinByInviteCodeInput, JoinByInviteCodeResponse, PreviewJoinByInviteCodeResponse, UpdateTeamParams } from '../../api/services/team-service';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type { CreateTeamInput } from '@volt/contracts/modules/team/http';

const TEAM_BOOT_STALE_TIME = 5 * 60 * 1000;

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
}

const extractTeamId = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    if (typeof value !== 'object' || value === null || !('teamId' in value)) return null;
    const { teamId } = value as TeamScopedValue;
    return typeof teamId === 'string' ? teamId : null;
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

const setTeamsQueryData = (updater: (previous?: Team[]) => Team[] | undefined) => {
    queryClient.setQueryData<Team[]>(TEAM_QUERY_KEYS.teams(), updater);
};

export const invalidateTeamsQuery = () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.teams() });

const removeTeamScopedQueries = (teamId: string) => {
    queryClient.removeQueries({
        predicate: (query) => matchesTeamScopedQuery(query.queryKey, teamId)
    });
};

const useTeamsQueryBase = createQuery<void, Team[]>(
    TEAM_QUERY_KEYS.teams,
    () => teamService.getAll({})
);

export const useTeamsQuery = (_params?: void, options?: QueryOptions<Team[]>) => {
    return useTeamsQueryBase(undefined, {
        staleTime: TEAM_BOOT_STALE_TIME,
        ...options
    });
};

const useTeamPermissionsQueryBase = createQuery<string, string[]>(
    TEAM_QUERY_KEYS.teamPermissions,
    (teamId: string) => teamService.getMyPermissions({ teamId })
);

export const useTeamPermissionsQuery = (teamId: string, options?: QueryOptions<string[]>) => {
    return useTeamPermissionsQueryBase(teamId, {
        staleTime: TEAM_BOOT_STALE_TIME,
        ...options
    });
};

export const usePreviewJoinByCodeQuery = createQuery<JoinByInviteCodeInput, PreviewJoinByInviteCodeResponse>(
    (params) => TEAM_QUERY_KEYS.joinByCodePreview(params.code),
    (params) => teamService.previewJoinByCode(params)
);

export const useCreateTeamMutation = createMutation<Team, CreateTeamInput>(
    teamService.create,
    (newTeam) => {
        setTeamsQueryData((previous) => {
            if (!previous) return [newTeam];
            return [newTeam, ...previous];
        });
    }
);

export const useUpdateTeamMutation = createMutation<Team, UpdateTeamParams>(
    teamService.update,
    (updatedTeam) => {
        setTeamsQueryData((previous) => {
            if (!previous) return previous;
            return previous.map((team) => team._id === updatedTeam._id ? updatedTeam : team);
        });
    }
);

export const useLeaveTeamMutation = () => {
    return useMutation<void, Error, TeamScopedParams, { previousTeams?: Team[] }>({
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
                queryClient.setQueryData<Team[]>(TEAM_QUERY_KEYS.teams(), context.previousTeams);
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

export const useGenerateInviteCodeMutation = createMutation<Team, TeamScopedParams>(
    teamService.generateInviteCode,
    (updatedTeam) => {
        setTeamsQueryData((previous) => {
            if (!previous) return previous;
            return previous.map((team) => team._id === updatedTeam._id ? updatedTeam : team);
        });
    }
);

export const useDeleteInviteCodeMutation = createMutation<void, TeamScopedParams>(
    teamService.deleteInviteCode,
    (_data, variables) => {
        setTeamsQueryData((previous) => {
            if (!previous) return previous;
            return previous.map((team) => {
                if (team._id !== variables.teamId) return team;
                return {
                    ...team,
                    inviteCode: undefined
                };
            });
        });
    }
);

export const useJoinByCodeMutation = createInvalidatingMutation<JoinByInviteCodeResponse, JoinByInviteCodeInput>(
    teamService.joinByCode,
    [TEAM_QUERY_KEYS.teams()]
);
