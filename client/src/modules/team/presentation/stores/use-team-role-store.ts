import { create } from 'zustand';
import type { TeamRole } from '@/modules/team/domain/entities';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

interface TeamRoleStore extends BaseSlice {
    roles: TeamRole[];
    setRoles: (roles: TeamRole[]) => void;
    addRole: (role: TeamRole) => void;
    updateRole: (id: string, updates: Partial<TeamRole>) => void;
    removeRole: (id: string) => void;
    reset: () => void;
};

const initialState = { roles: [] as TeamRole[], ...BASE_SLICE_INITIAL_STATE };

export const useTeamRoleStore = create<TeamRoleStore>((set) => ({
    ...initialState,
    ...createBaseSlice(set),
    setRoles: (roles) => set({ roles }),
    addRole: (role) => set((s) => ({ roles: [...s.roles, role] })),
    updateRole: (id, updates) => set((s) => ({ 
        roles: s.roles.map((r) => r._id === id ? { ...r, ...updates } : r) 
    })),
    removeRole: (id) => set((s) => ({ roles: s.roles.filter((r) => r._id !== id) })),
    reset: () => set(initialState)
}));
