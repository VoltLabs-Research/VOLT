import { create } from 'zustand';
import type { TeamRole } from '@/modules/team/domain/entities';

interface TeamRoleStore {
    roles: TeamRole[];
    isLoading: boolean;
    error: string | null;
    setRoles: (roles: TeamRole[]) => void;
    addRole: (role: TeamRole) => void;
    updateRole: (id: string, updates: Partial<TeamRole>) => void;
    removeRole: (id: string) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

const initialState = { roles: [] as TeamRole[], isLoading: false, error: null as string | null };

export const useTeamRoleStore = create<TeamRoleStore>((set) => ({
    ...initialState,
    setRoles: (roles) => set({ roles }),
    addRole: (role) => set((s) => ({ roles: [...s.roles, role] })),
    updateRole: (id, updates) => set((s) => ({ 
        roles: s.roles.map((r) => r._id === id ? { ...r, ...updates } : r) 
    })),
    removeRole: (id) => set((s) => ({ roles: s.roles.filter((r) => r._id !== id) })),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    reset: () => set(initialState)
}));
