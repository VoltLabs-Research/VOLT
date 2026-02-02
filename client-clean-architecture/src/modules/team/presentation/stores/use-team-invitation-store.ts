import { create } from 'zustand';
import type { TeamInvitation } from '@/modules/team/domain/entities';

interface TeamInvitationStore {
    invitations: TeamInvitation[];
    isLoading: boolean;
    error: string | null;
    setInvitations: (invitations: TeamInvitation[]) => void;
    addInvitation: (invitation: TeamInvitation) => void;
    removeInvitation: (id: string) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

const initialState = { invitations: [] as TeamInvitation[], isLoading: false, error: null as string | null };

export const useTeamInvitationStore = create<TeamInvitationStore>((set) => ({
    ...initialState,
    setInvitations: (invitations) => set({ invitations }),
    addInvitation: (invitation) => set((s) => ({ invitations: [...s.invitations, invitation] })),
    removeInvitation: (id) => set((s) => ({ invitations: s.invitations.filter((i) => i._id !== id) })),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    reset: () => set(initialState)
}));
