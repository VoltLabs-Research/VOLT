import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { Team, TeamMember, CreateTeamPayload, UpdateTeamPayload } from '../../domain/entities';
import { TeamSelectionService } from '../../domain/services/TeamSelectionService';
import { getTeamUseCases } from '../../application/registry';
import type { TeamUseCases } from '../../application/registry';

export interface TeamState {
    teams: Team[];
    selectedTeam: Team | null;
    isLoading: boolean;
    error: string | null;

    members: TeamMember[];
    admins: TeamMember[];
    owner: TeamMember | null;
    onlineUsers: string[];
}

export interface TeamActions {
    getUserTeams: () => Promise<void>;
    setSelectedTeam: (teamId: string) => void;
    createTeam: (data: CreateTeamPayload) => Promise<Team>;
    updateTeam: (teamId: string, data: UpdateTeamPayload) => Promise<void>;
    deleteTeam: (teamId: string) => Promise<void>;
    leaveTeam: (teamId: string) => Promise<void>;
    clearError: () => void;
    reset: () => void;

    fetchMembers: (teamId: string, force?: boolean) => Promise<void>;
    removeMember: (teamId: string, userId: string) => Promise<void>;

    setOnlineUsers: (userIds: string[]) => void;
    addOnlineUser: (userId: string) => void;
    removeOnlineUser: (userId: string) => void;
    initializeSocket: (teamId: string) => () => void;
}

export type TeamSlice = TeamState & TeamActions;

export const initialState: TeamState = {
    teams: [],
    selectedTeam: null,
    isLoading: false,
    error: null,
    members: [],
    admins: [],
    owner: null,
    onlineUsers: []
};

let fetchedMembersForTeam: string | null = null;
const resolveUseCases = (): TeamUseCases => getTeamUseCases();
const teamSelectionService = new TeamSelectionService();

export const createTeamSlice: SliceCreator<TeamSlice> = (set, get) => ({
    ...initialState,

    getUserTeams: async () => {
        const { getUserTeamsUseCase, subscribeToTeamSocketUseCase } = resolveUseCases();
        const state = get() as TeamSlice;
        if (state.teams.length > 0) return;

        await runRequest(set, get, () => getUserTeamsUseCase.execute(), {
            errorFallback: 'Failed to load teams',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (teams) => {
                const storedSelectedTeamId = localStorage.getItem('selectedTeamId');
                const nextSelectedTeam = teamSelectionService.selectInitialTeam(teams, storedSelectedTeamId);

                set({
                    teams,
                    selectedTeam: nextSelectedTeam,
                    error: null
                } as Partial<TeamSlice>);

                if (nextSelectedTeam) {
                    subscribeToTeamSocketUseCase.execute(nextSelectedTeam._id);
                }
            }
        });
    },

    setSelectedTeam: (teamId) => {
        const { subscribeToTeamSocketUseCase } = resolveUseCases();
        const state = get() as TeamSlice;
        const selectedTeam = state.teams.find((team) => team._id === teamId);
        if (!selectedTeam) return;

        fetchedMembersForTeam = null;

        set({
            selectedTeam,
            members: [],
            admins: [],
            owner: null,
            onlineUsers: []
        } as Partial<TeamSlice>);

        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedTeamId', teamId);
        }

        subscribeToTeamSocketUseCase.execute(teamId);
    },

    createTeam: async (data) => {
        const { createTeamUseCase, subscribeToTeamSocketUseCase } = resolveUseCases();
        const result = await runRequest(set, get, () => createTeamUseCase.execute(data), {
            errorFallback: 'Failed to create team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Team created successfully',
            onSuccess: (createdTeam) => {
                set((state: TeamSlice) => ({
                    teams: [createdTeam, ...state.teams],
                    selectedTeam: createdTeam,
                    error: null
                }));
                subscribeToTeamSocketUseCase.execute(createdTeam._id);
            }
        });

        return result as Team;
    },

    updateTeam: async (teamId, data) => {
        const { updateTeamUseCase } = resolveUseCases();
        await runRequest(set, get, () => updateTeamUseCase.execute(teamId, data), {
            errorFallback: 'Failed to update team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Team updated successfully',
            onSuccess: (updatedTeam) =>
                set((state: TeamSlice) => {
                    const currentTeam = state.teams.find((team) => team._id === teamId);
                    const mergedTeam = teamSelectionService.mergeUpdatedTeam(updatedTeam, currentTeam, state.owner);

                    const nextTeams = state.teams.map((team) => (team._id === teamId ? mergedTeam : team));
                    const nextSelectedTeam = state.selectedTeam?._id === teamId ? mergedTeam : state.selectedTeam;

                    return {
                        teams: nextTeams,
                        selectedTeam: nextSelectedTeam
                    } as Partial<TeamSlice>;
                })
        });
    },

    deleteTeam: async (teamId) => {
        const { deleteTeamUseCase } = resolveUseCases();
        await runRequest(set, get, () => deleteTeamUseCase.execute(teamId), {
            errorFallback: 'Failed to delete team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Team deleted successfully',
            onSuccess: () =>
                set((state: TeamSlice) => {
                    return teamSelectionService.applyDeletion(state.teams, teamId, state.selectedTeam?._id);
                })
        });
    },

    leaveTeam: async (teamId) => {
        const { leaveTeamUseCase } = resolveUseCases();
        await runRequest(set, get, () => leaveTeamUseCase.execute(teamId), {
            errorFallback: 'Failed to leave team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Left team successfully',
            onSuccess: () =>
                set((state: TeamSlice) => {
                    const nextTeams = state.teams.filter((team) => team._id !== teamId);
                    const isLeftSelected = state.selectedTeam?._id === teamId;

                    return {
                        teams: nextTeams,
                        selectedTeam: isLeftSelected ? nextTeams[0] ?? null : state.selectedTeam
                    };
                })
        });
    },

    clearError: () => set({ error: null } as Partial<TeamSlice>),

    reset: () => set(initialState as TeamSlice),

    fetchMembers: async (teamId, force = false) => {
        const { getTeamMembersUseCase } = resolveUseCases();
        if (!force && fetchedMembersForTeam === teamId) return;

        await runRequest(set, get, () => getTeamMembersUseCase.execute(), {
            errorFallback: 'Failed to fetch members',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (data) => {
                fetchedMembersForTeam = teamId;
                set({
                    members: data.members,
                    admins: data.admins,
                    owner: data.owner
                } as Partial<TeamSlice>);
            }
        });
    },

    removeMember: async (teamId, userId) => {
        const { removeTeamMemberUseCase } = resolveUseCases();
        await runRequest(set, get, () => removeTeamMemberUseCase.execute(teamId, { userId }), {
            errorFallback: 'Failed to remove member',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Member removed successfully',
            onSuccess: () =>
                set((state: TeamSlice) => ({
                    members: state.members.filter((member) => member._id !== userId),
                    admins: state.admins.filter((admin) => admin._id !== userId)
                }))
        });
    },

    setOnlineUsers: (userIds) => set({ onlineUsers: userIds } as Partial<TeamSlice>),

    addOnlineUser: (userId) => {
        const state = get() as TeamSlice;
        const alreadyOnline = state.onlineUsers.includes(userId);
        if (alreadyOnline) return;

        set({ onlineUsers: [...state.onlineUsers, userId] } as Partial<TeamSlice>);
    },

    removeOnlineUser: (userId) =>
        set((state: TeamSlice) => ({
            onlineUsers: state.onlineUsers.filter((id) => id !== userId)
        })),

    initializeSocket: (teamId) => {
        const { initializeTeamPresenceSocketUseCase } = resolveUseCases();
        const store = get() as TeamSlice;

        const { offUserOnline, offUserOffline, offPresenceList } = initializeTeamPresenceSocketUseCase.execute(teamId, {
            onUserOnline: (userId) => store.addOnlineUser(userId),
            onUserOffline: (userId) => store.removeOnlineUser(userId),
            onPresenceList: (userIds) => store.setOnlineUsers(userIds)
        });

        return () => {
            offUserOnline();
            offUserOffline();
            offPresenceList();
        };
    }
});
