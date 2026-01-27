import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { TeamRole, TeamRolePayload, TeamMemberWithRole } from '../../domain/entities';
import { teamRoleRepository } from '../../infrastructure/repositories/TeamRoleRepository';
import { teamRoleAssignmentRepository } from '../../infrastructure/repositories/TeamRoleAssignmentRepository';

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

let fetchedRolesForTeam: string | null = null;

export const createTeamRoleSlice: SliceCreator<TeamRoleSlice> = (set, get) => ({
    ...initialState,

    fetchRoles: async (teamId) => {
        if (fetchedRolesForTeam === teamId) return;

        await runRequest(set, get, () => teamRoleRepository.getAll(), {
            errorFallback: 'Failed to fetch roles',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (response) => {
                fetchedRolesForTeam = teamId;
                set({ roles: response } as Partial<TeamRoleSlice>);
            }
        });
    },

    createRole: async (_teamId, data) => {
        return await runRequest(set, get, () => teamRoleRepository.create(data), {
            loadingKey: 'isSaving',
            errorFallback: 'Failed to create role',
            rethrow: true,
            onSuccess: (role) => set((s: TeamRoleSlice) => ({ roles: [...s.roles, role] }))
        });
    },

    updateRole: async (_teamId, roleId, data) => {
        return await runRequest(set, get, () => teamRoleRepository.update(roleId, data), {
            loadingKey: 'isSaving',
            errorFallback: 'Failed to update role',
            rethrow: true,
            onSuccess: (role) => set((s: TeamRoleSlice) => ({ roles: s.roles.map(r => r._id === roleId ? role : r) }))
        });
    },

    deleteRole: async (_teamId, roleId) => {
        await runRequest(set, get, () => teamRoleRepository.deleteRole(roleId), {
            loadingKey: 'isSaving',
            errorFallback: 'Failed to delete role',
            rethrow: true,
            successMessage: 'Role deleted successfully',
            onSuccess: () => set((s: TeamRoleSlice) => ({ roles: s.roles.filter(r => r._id !== roleId) }))
        });
    },

    assignRole: async (_teamId, memberId, roleId) => {
        return await runRequest(set, get, () => teamRoleAssignmentRepository.assignRole(memberId, roleId), {
            loadingKey: 'isSaving',
            errorFallback: 'Failed to assign role',
            rethrow: true,
            onSuccess: (member) => set((s: TeamRoleSlice) => ({ members: s.members.map(m => m._id === memberId ? member : m) }))
        });
    }
});
