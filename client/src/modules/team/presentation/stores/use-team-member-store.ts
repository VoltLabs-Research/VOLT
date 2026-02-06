import { create } from 'zustand';
import type { TeamMember } from '@/modules/team/domain/entities';

interface TeamMemberStore {
    members: TeamMember[];
    isLoading: boolean;
    error: string | null;
    setMembers: (members: TeamMember[]) => void;
    addMember: (member: TeamMember) => void;
    updateMember: (id: string, updates: Partial<TeamMember>) => void;
    removeMember: (id: string) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

const initialState = { members: [] as TeamMember[], isLoading: false, error: null as string | null };

export const useTeamMemberStore = create<TeamMemberStore>((set) => ({
    ...initialState,
    setMembers: (members) => set({ members }),
    addMember: (member) => set((s) => ({ members: [...s.members, member] })),
    updateMember: (id, updates) => set((s) => ({ 
        members: s.members.map((m) => m._id === id ? { ...m, ...updates } : m) 
    })),
    removeMember: (id) => set((s) => ({ members: s.members.filter((m) => m._id !== id) })),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    reset: () => set(initialState)
}));
