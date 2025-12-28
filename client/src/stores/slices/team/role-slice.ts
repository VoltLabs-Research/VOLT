import type { TeamRole, TeamRolePayload, TeamMemberWithRole } from '@/types/team-role';
import teamRoleApi from '@/services/api/team-role/team-role';
import teamMemberApi from '@/services/api/team-member/team-member';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

export interface TeamRoleState {
    roles: TeamRole[];
    members: TeamMemberWithRole[];
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
}

export interface TeamRoleActions {
    fetchRoles: (teamId: string) => Promise<void>;
    createRole: (teamId: string, data: TeamRolePayload) => Promise<TeamRole | null>;
    updateRole: (teamId: string, roleId: string, data: Partial<TeamRolePayload>) => Promise<TeamRole | null>;
    deleteRole: (teamId: string, roleId: string) => Promise<void>;
    assignRole: (teamId: string, memberId: string, roleId: string) => Promise<TeamMemberWithRole | null>;
}

export type TeamRoleSlice = TeamRoleState & TeamRoleActions;

export const initialState: TeamRoleState = { roles: [], members: [], isLoading: false, isSaving: false, error: null };

export const createTeamRoleSlice: SliceCreator<TeamRoleSlice> = (set, get) => ({
    ...initialState,

    fetchRoles: async (teamId) => {
        await runRequest(set, get, () => teamRoleApi.getAll(teamId), {
            errorFallback: 'Failed to fetch roles', rethrow: true,
            onSuccess: (roles) => set({ roles } as Partial<TeamRoleSlice>)
        });
    },

    createRole: async (teamId, data) => {
        return await runRequest(set, get, () => teamRoleApi.create(teamId, data), {
            loadingKey: 'isSaving', errorFallback: 'Failed to create role', rethrow: true,
            onSuccess: (role) => set((s: TeamRoleSlice) => ({ roles: [...s.roles, role] }))
        });
    },

    updateRole: async (teamId, roleId, data) => {
        return await runRequest(set, get, () => teamRoleApi.update(teamId, roleId, data), {
            loadingKey: 'isSaving', errorFallback: 'Failed to update role', rethrow: true,
            onSuccess: (role) => set((s: TeamRoleSlice) => ({ roles: s.roles.map(r => r._id === roleId ? role : r) }))
        });
    },

    deleteRole: async (teamId, roleId) => {
        await runRequest(set, get, () => teamRoleApi.delete(teamId, roleId), {
            loadingKey: 'isSaving', errorFallback: 'Failed to delete role', rethrow: true,
            onSuccess: () => set((s: TeamRoleSlice) => ({ roles: s.roles.filter(r => r._id !== roleId) }))
        });
    },

    assignRole: async (_teamId, memberId, roleId) => {
        return await runRequest(set, get, () => teamMemberApi.update(memberId, { role: roleId }), {
            loadingKey: 'isSaving', errorFallback: 'Failed to assign role', rethrow: true,
            onSuccess: (member) => set((s: TeamRoleSlice) => ({ members: s.members.map(m => m._id === memberId ? member : m) }))
        });
    }
});
