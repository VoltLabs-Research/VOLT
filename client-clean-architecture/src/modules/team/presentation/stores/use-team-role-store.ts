import { create } from 'zustand';
import type { TeamRole } from '@/modules/team/domain/entities';

interface TeamRoleState {
    roles: TeamRole[];
    isLoading: boolean;
    error: string | null;
};

interface TeamRoleActions {
    setRoles: (roles: TeamRole[]) => void;
    addRole: (role: TeamRole) => void;
    updateRoleInList: (roleId: string, updates: Partial<TeamRole>) => void;
    removeRole: (roleId: string) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type TeamRoleStore = TeamRoleState & TeamRoleActions;

const initialState: TeamRoleState = {
    roles: [],
    isLoading: false,
    error: null
};

export const useTeamRoleStore = create<TeamRoleStore>((set) => ({
    ...initialState,

    setRoles: (roles) => set({ roles }),

    addRole: (role) => {
        set((state) => ({
            roles: [...state.roles, role]
        }));
    },

    updateRoleInList: (roleId, updates) => {
        set((state) => ({
            roles: state.roles.map((r) => 
                r._id === roleId ? { ...r, ...updates } : r
            )
        }));
    },

    removeRole: (roleId) => {
        set((state) => ({
            roles: state.roles.filter((r) => r._id !== roleId)
        }));
    },

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));
