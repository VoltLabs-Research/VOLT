import { create } from 'zustand';

import type { TeamRole, TeamRolePayload, TeamMemberWithRole } from '@/types/team-role';
import teamRoleApi from '@/services/api/team-role';
import teamMemberApi from '@/services/api/team-member';

interface TeamRoleState {
    roles: TeamRole[];
    members: TeamMemberWithRole[];
    selectedRole: TeamRole | null;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
}

interface TeamRoleStore extends TeamRoleState {
    fetchRoles: (teamId: string) => Promise<void>;
    createRole: (teamId: string, data: TeamRolePayload) => Promise<TeamRole>;
    updateRole: (teamId: string, roleId: string, data: Partial<TeamRolePayload>) => Promise<TeamRole>;
    deleteRole: (teamId: string, roleId: string) => Promise<void>;
    assignRole: (teamId: string, memberId: string, roleId: string) => Promise<TeamMemberWithRole>;
    setSelectedRole: (role: TeamRole | null) => void;
    clearSelectedRole: () => void;
    reset: () => void;
}

const initialState: TeamRoleState = {
    roles: [],
    members: [],
    selectedRole: null,
    isLoading: false,
    isSaving: false,
    error: null
};

const useTeamRoleStore = create<TeamRoleStore>((set, get) => ({
    ...initialState,

    fetchRoles: async (teamId: string) => {
        set({ isLoading: true, error: null });
        try {
            const roles = await teamRoleApi.getAll(teamId);
            set({ roles, error: null, isLoading: false });
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to fetch roles';
            set({ isLoading: false, error: errorMessage });
            throw errorMessage;
        }
    },

    createRole: async (teamId: string, data: TeamRolePayload) => {
        set({ isSaving: true, error: null });
        try {
            const newRole = await teamRoleApi.create(teamId, data);
            const currentRoles = get().roles;
            set({
                roles: [...currentRoles, newRole],
                error: null,
                isSaving: false
            });
            return newRole;
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to create role';
            set({ isSaving: false, error: errorMessage });
            throw errorMessage;
        }
    },

    updateRole: async (teamId: string, roleId: string, data: Partial<TeamRolePayload>) => {
        set({ isSaving: true, error: null });
        try {
            const updatedRole = await teamRoleApi.update(teamId, roleId, data);
            const currentRoles = get().roles;
            set({
                roles: currentRoles.map(r => r._id === roleId ? updatedRole : r),
                selectedRole: get().selectedRole?._id === roleId ? updatedRole : get().selectedRole,
                error: null,
                isSaving: false
            });
            return updatedRole;
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to update role';
            set({ isSaving: false, error: errorMessage });
            throw errorMessage;
        }
    },

    deleteRole: async (teamId: string, roleId: string) => {
        set({ isSaving: true, error: null });
        try {
            await teamRoleApi.delete(teamId, roleId);
            const currentRoles = get().roles;
            set({
                roles: currentRoles.filter(r => r._id !== roleId),
                selectedRole: get().selectedRole?._id === roleId ? null : get().selectedRole,
                error: null,
                isSaving: false
            });
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to delete role';
            set({ isSaving: false, error: errorMessage });
            throw errorMessage;
        }
    },

    assignRole: async (teamId: string, memberId: string, roleId: string) => {
        set({ isSaving: true, error: null });
        try {
            const updatedMember = await teamMemberApi.update(memberId, { role: roleId });
            const currentMembers = get().members;
            set({
                members: currentMembers.map(m => m._id === memberId ? updatedMember : m),
                error: null,
                isSaving: false
            });
            return updatedMember;
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to assign role';
            set({ isSaving: false, error: errorMessage });
            throw errorMessage;
        }
    },

    setSelectedRole: (role: TeamRole | null) => set({ selectedRole: role }),

    clearSelectedRole: () => set({ selectedRole: null }),

    reset: () => set(initialState)
}));

export default useTeamRoleStore;
