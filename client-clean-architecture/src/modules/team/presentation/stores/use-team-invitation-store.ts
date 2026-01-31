import { create } from 'zustand';
import type { TeamInvitation } from '@/modules/team/domain/entities';

interface TeamInvitationState {
    pendingInvitations: TeamInvitation[];
    isLoading: boolean;
    error: string | null;
};

interface TeamInvitationActions {
    setPendingInvitations: (invitations: TeamInvitation[]) => void;
    addInvitation: (invitation: TeamInvitation) => void;
    removeInvitation: (invitationId: string) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type TeamInvitationStore = TeamInvitationState & TeamInvitationActions;

const initialState: TeamInvitationState = {
    pendingInvitations: [],
    isLoading: false,
    error: null
};

export const useTeamInvitationStore = create<TeamInvitationStore>((set) => ({
    ...initialState,

    setPendingInvitations: (invitations) => set({ pendingInvitations: invitations }),

    addInvitation: (invitation) => {
        set((state) => ({
            pendingInvitations: [...state.pendingInvitations, invitation]
        }));
    },

    removeInvitation: (invitationId) => {
        set((state) => ({
            pendingInvitations: state.pendingInvitations.filter((i) => i._id !== invitationId)
        }));
    },

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));
