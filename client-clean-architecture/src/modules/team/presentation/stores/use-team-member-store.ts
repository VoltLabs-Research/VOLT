import { create } from 'zustand';
import type { TeamMember } from '@/modules/team/domain/entities';

interface TeamMemberState {
    members: TeamMember[];
    isLoading: boolean;
    error: string | null;
};

interface TeamMemberActions {
    setMembers: (members: TeamMember[]) => void;
    addMember: (member: TeamMember) => void;
    updateMemberInList: (memberId: string, updates: Partial<TeamMember>) => void;
    removeMember: (memberId: string) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type TeamMemberStore = TeamMemberState & TeamMemberActions;

const initialState: TeamMemberState = {
    members: [],
    isLoading: false,
    error: null
};

export const useTeamMemberStore = create<TeamMemberStore>((set) => ({
    ...initialState,

    setMembers: (members) => set({ members }),

    addMember: (member) => {
        set((state) => ({
            members: [...state.members, member]
        }));
    },

    updateMemberInList: (memberId, updates) => {
        set((state) => ({
            members: state.members.map((m) => 
                m._id === memberId ? { ...m, ...updates } : m
            )
        }));
    },

    removeMember: (memberId) => {
        set((state) => ({
            members: state.members.filter((m) => m._id !== memberId)
        }));
    },

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));
