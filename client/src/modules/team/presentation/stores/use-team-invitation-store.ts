import { create } from 'zustand';
import type { TeamInvitation } from '@/modules/team/domain/entities';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

interface TeamInvitationStore extends BaseSlice {
    invitations: TeamInvitation[];
    setInvitations: (invitations: TeamInvitation[]) => void;
    addInvitation: (invitation: TeamInvitation) => void;
    removeInvitation: (id: string) => void;
    reset: () => void;
};

const initialState = { invitations: [] as TeamInvitation[], ...BASE_SLICE_INITIAL_STATE };

export const useTeamInvitationStore = create<TeamInvitationStore>((set) => ({
    ...initialState,
    ...createBaseSlice(set),
    setInvitations: (invitations) => set({ invitations }),
    addInvitation: (invitation) => set((s) => ({ invitations: [...s.invitations, invitation] })),
    removeInvitation: (id) => set((s) => ({ invitations: s.invitations.filter((i) => i._id !== id) })),
    reset: () => set(initialState)
}));
