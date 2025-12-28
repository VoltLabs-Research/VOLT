import { create } from 'zustand';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { TeamRole, TeamRolePayload, TeamMemberWithRole } from '@/types/team-role';
import teamRoleApi from '@/services/api/team-role';

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
    fetchMembers: (teamId: string) => Promise<void>;
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

const useTeamRoleStore = create<TeamRoleStore>((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        ...initialState,

        fetchRoles: (teamId: string) => asyncAction(
            () => teamRoleApi.getAll(teamId),
            {
                loadingKey: 'isLoading',
                onSuccess: (roles) => ({ roles, error: null }),
                onError: (error) => ({ error: error?.message || 'Failed to fetch roles' })
            }
        ),

        createRole: (teamId: string, data: TeamRolePayload) => asyncAction(
            () => teamRoleApi.create(teamId, data),
            {
                loadingKey: 'isSaving',
                onSuccess: (newRole) => {
                    const currentRoles = get().roles;
                    return {
                        roles: [...currentRoles, newRole],
                        error: null
                    };
                },
                onError: (error) => ({ error: error?.message || 'Failed to create role' })
            }
        ).then(() => {
            const roles = get().roles;
            return roles[roles.length - 1];
        }),

        updateRole: (teamId: string, roleId: string, data: Partial<TeamRolePayload>) => asyncAction(
            () => teamRoleApi.update(teamId, roleId, data),
            {
                loadingKey: 'isSaving',
                onSuccess: (updatedRole) => {
                    const currentRoles = get().roles;
                    return {
                        roles: currentRoles.map(r => r._id === roleId ? updatedRole : r),
                        selectedRole: get().selectedRole?._id === roleId ? updatedRole : get().selectedRole,
                        error: null
                    };
                },
                onError: (error) => ({ error: error?.message || 'Failed to update role' })
            }
        ).then(() => {
            return get().roles.find(r => r._id === roleId)!;
        }),

        deleteRole: (teamId: string, roleId: string) => asyncAction(
            () => teamRoleApi.delete(teamId, roleId),
            {
                loadingKey: 'isSaving',
                onSuccess: () => {
                    const currentRoles = get().roles;
                    return {
                        roles: currentRoles.filter(r => r._id !== roleId),
                        selectedRole: get().selectedRole?._id === roleId ? null : get().selectedRole,
                        error: null
                    };
                },
                onError: (error) => ({ error: error?.message || 'Failed to delete role' })
            }
        ),

        fetchMembers: (teamId: string) => asyncAction(
            () => teamRoleApi.getMembers(teamId),
            {
                loadingKey: 'isLoading',
                onSuccess: (members) => ({ members, error: null }),
                onError: (error) => ({ error: error?.message || 'Failed to fetch members' })
            }
        ),

        assignRole: (teamId: string, memberId: string, roleId: string) => asyncAction(
            () => teamRoleApi.assignRole(teamId, memberId, roleId),
            {
                loadingKey: 'isSaving',
                onSuccess: (updatedMember) => {
                    const currentMembers = get().members;
                    return {
                        members: currentMembers.map(m => m._id === memberId ? updatedMember : m),
                        error: null
                    };
                },
                onError: (error) => ({ error: error?.message || 'Failed to assign role' })
            }
        ).then(() => {
            return get().members.find(m => m._id === memberId)!;
        }),

        setSelectedRole: (role: TeamRole | null) => set({ selectedRole: role }),

        clearSelectedRole: () => set({ selectedRole: null }),

        reset: () => set(initialState)
    };
});

export default useTeamRoleStore;
