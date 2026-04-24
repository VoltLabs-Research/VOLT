import teamService from '../../api/services/team';
import {
    buildKeys,
    createMutation,
    createInvalidatingMutation,
    createQuery,
    queryClient
} from '@/shared/infrastructure/query';
import type { QueryOptions } from '@/shared/infrastructure/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import { useMutation } from '@tanstack/react-query';
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

const TEAM_BOOT_STALE_TIME = 5 * 60 * 1000;

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

const setTeamsQueryData = (updater: (previous?: Team[]) => Team[] | undefined) => {
    queryClient.setQueryData<Team[]>(TEAM_QUERY_KEYS.teams(), updater);
};

export const invalidateTeamsQuery = () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.teams() });

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

const usePreviewJoinByCodeQueryBase = createQuery<PreviewJoinByInviteCodeInputDTO, PreviewJoinByInviteCodeOutputDTO>(
    (params) => TEAM_QUERY_KEYS.joinByCodePreview(params.code),
    (params) => teamService.previewJoinByCode(params)
);

export const usePreviewJoinByCodeQuery = (
    params: PreviewJoinByInviteCodeInputDTO,
    options?: QueryOptions<PreviewJoinByInviteCodeOutputDTO>
) => {
    return usePreviewJoinByCodeQueryBase(params, options);
};

/** Team mutations. */

export const useCreateTeamMutation = createMutation<Team, CreateTeamInputDTO>(
    teamService.create,
    (newTeam) => {
        setTeamsQueryData((previous) => {
            if (!previous) return [newTeam];
            return [newTeam, ...previous];
        });
    }
);

export const useUpdateTeamMutation = createMutation<Team, UpdateTeamInputDTO>(
    teamService.update,
    (updatedTeam) => {
        setTeamsQueryData((previous) => {
            if (!previous) return previous;
            return previous.map((team) => team._id === updatedTeam._id ? updatedTeam : team);
        });
    }
);

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

export const useGenerateInviteCodeMutation = createMutation<Team, GenerateInviteCodeInputDTO>(
    teamService.generateInviteCode,
    (updatedTeam) => {
        setTeamsQueryData((previous) => {
            if (!previous) return previous;
            return previous.map((team) => team._id === updatedTeam._id ? updatedTeam : team);
        });
    }
);

export const useDeleteInviteCodeMutation = createMutation<void, DeleteInviteCodeInputDTO>(
    teamService.deleteInviteCode,
    (_data, variables) => {
        setTeamsQueryData((previous) => {
            if (!previous) return previous;
            return previous.map((team) => {
                if (team._id !== variables.teamId) return team;
                return { ...team, inviteCode: undefined };
            });
        });
    }
);

export const useJoinByCodeMutation = createInvalidatingMutation<JoinByInviteCodeOutputDTO, JoinByInviteCodeInputDTO>(
    teamService.joinByCode,
    [TEAM_QUERY_KEYS.teams()]
);
