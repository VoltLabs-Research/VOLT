import { create } from 'zustand';
import type { TeamMember } from '@/modules/team/domain/entities';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

interface TeamMemberStore extends BaseSlice {
    members: TeamMember[];
    setMembers: (members: TeamMember[]) => void;
    addMember: (member: TeamMember) => void;
    updateMember: (id: string, updates: Partial<TeamMember>) => void;
    removeMember: (id: string) => void;
    reset: () => void;
};

const initialState = { members: [] as TeamMember[], ...BASE_SLICE_INITIAL_STATE };

export const useTeamMemberStore = create<TeamMemberStore>((set) => ({
    ...initialState,
    ...createBaseSlice(set),
    setMembers: (members) => set({ members }),
    addMember: (member) => set((s) => ({ members: [...s.members, member] })),
    updateMember: (id, updates) => set((s) => ({ 
        members: s.members.map((m) => m._id === id ? { ...m, ...updates } : m) 
    })),
    removeMember: (id) => set((s) => ({ members: s.members.filter((m) => m._id !== id) })),
    reset: () => set(initialState)
}));
