import type { TeamState, TeamStore } from '@/types/stores/team/team';
import teamApi from '@/features/team/api/team';
import { socketService } from '@/services/websockets/socketio';
import teamMember from '@/features/team/api/team-member';
import { runRequest } from '@/stores/helpers';
import type { SliceCreator } from '@/stores/helpers/create-slice';

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

// Track which team's members have been fetched
let fetchedMembersForTeam: string | null = null;

export const createTeamSlice: SliceCreator<TeamStore> = (set, get) => ({
    ...initialState,

    getUserTeams: async () => {
        const state = get() as TeamStore;
        // Skip if already have teams
        if (state.teams.length > 0) return;

        await runRequest(set, get, () => teamApi.getAll(), {
            errorFallback: 'Failed to load teams',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (teams) => {
                const storedSelectedTeamId = localStorage.getItem('selectedTeamId');
                const storedSelectedTeam = teams.find((team) => team._id === storedSelectedTeamId) ?? null;

                const fallbackSelectedTeam = teams[0] ?? null;

                const nextSelectedTeam = storedSelectedTeam ?? fallbackSelectedTeam;

                set({
                    teams,
                    selectedTeam: nextSelectedTeam,
                    error: null
                } as Partial<TeamStore>);

                if (nextSelectedTeam) {
                    socketService.subscribeToTeam(nextSelectedTeam._id);
                }
            }
        });
    },

    setSelectedTeam: (teamId) => {
        const state = get() as TeamStore;

        const selectedTeam = state.teams.find((team) => team._id === teamId);
        if (!selectedTeam) return;

        // Reset members cache when switching teams
        fetchedMembersForTeam = null;

        set({
            selectedTeam,
            members: [],
            admins: [],
            owner: null,
            onlineUsers: []
        } as Partial<TeamStore>);

        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedTeamId', teamId);
        }

        socketService.subscribeToTeam(teamId);
    },

    createTeam: async (data) => {
        const result = await runRequest(set, get, () => teamApi.create(data), {
            errorFallback: 'Failed to create team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Team created successfully',
            onSuccess: (createdTeam) => {
                set((state: TeamStore) => ({
                    teams: [createdTeam, ...state.teams],
                    selectedTeam: createdTeam,
                    error: null
                }));
                socketService.subscribeToTeam(createdTeam._id);
            }
        });
        return result as any;
    },

    updateTeam: async (teamId, data) => {
        await runRequest(set, get, () => teamApi.update(teamId, data), {
            errorFallback: 'Failed to update team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Team updated successfully',
            onSuccess: (updatedTeam) =>
                set((state: TeamStore) => {
                    // Preserve populated fields (like owner) from the current team
                    const currentTeam = state.teams.find(t => t._id === teamId);
                    const mergedTeam = {
                        ...updatedTeam,
                        owner: updatedTeam.owner || currentTeam?.owner || (state.owner as any)
                    };

                    const nextTeams = state.teams.map((team) =>
                        team._id === teamId ? mergedTeam : team
                    );

                    const nextSelectedTeam =
                        state.selectedTeam?._id === teamId ? mergedTeam : state.selectedTeam;

                    return {
                        teams: nextTeams,
                        selectedTeam: nextSelectedTeam
                    } as Partial<TeamStore>;
                })
        });
    },

    deleteTeam: async (teamId) => {
        await runRequest(set, get, () => teamApi.delete(teamId), {
            errorFallback: 'Failed to delete team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Team deleted successfully',
            onSuccess: () =>
                set((state: TeamStore) => {
                    const nextTeams = state.teams.filter((team) => team._id !== teamId);
                    const isDeletedSelected = state.selectedTeam?._id === teamId;

                    return {
                        teams: nextTeams,
                        selectedTeam: isDeletedSelected ? nextTeams[0] ?? null : state.selectedTeam
                    };
                })
        });
    },

    leaveTeam: async (teamId) => {
        await runRequest(set, get, () => teamApi.leave(teamId), {
            errorFallback: 'Failed to leave team',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Left team successfully',
            onSuccess: () =>
                set((state: TeamStore) => {
                    const nextTeams = state.teams.filter((team) => team._id !== teamId);
                    const isLeftSelected = state.selectedTeam?._id === teamId;

                    return {
                        teams: nextTeams,
                        selectedTeam: isLeftSelected ? nextTeams[0] ?? null : state.selectedTeam
                    };
                })
        });
    },

    clearError: () => set({ error: null } as Partial<TeamStore>),

    reset: () => set(initialState as TeamStore),

    fetchMembers: async (teamId) => {
        // Skip if already fetched for this team
        if (fetchedMembersForTeam === teamId) return;

        await runRequest(set, get, () => teamMember.getAll(), {
            errorFallback: 'Failed to fetch members',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (data) => {
                fetchedMembersForTeam = teamId;
                set({
                    members: data.members,
                    admins: data.admins,
                    owner: data.owner
                } as Partial<TeamStore>);
            }
        });
    },

    removeMember: async (teamId, userId) => {
        await runRequest(set, get, () => teamApi.members.remove(teamId, { userId }), {
            errorFallback: 'Failed to remove member',
            rethrow: true,
            loadingKey: 'isLoading',
            successMessage: 'Member removed successfully',
            onSuccess: () =>
                set((state: TeamStore) => ({
                    members: state.members.filter((member) => member._id !== userId),
                    admins: state.admins.filter((admin) => admin._id !== userId)
                }))
        });
    },

    setOnlineUsers: (userIds) => set({ onlineUsers: userIds } as Partial<TeamStore>),

    addOnlineUser: (userId) => {
        const state = get() as TeamStore;
        const alreadyOnline = state.onlineUsers.includes(userId);
        if (alreadyOnline) return;

        set({ onlineUsers: [...state.onlineUsers, userId] } as Partial<TeamStore>);
    },

    removeOnlineUser: (userId) =>
        set((state: TeamStore) => ({
            onlineUsers: state.onlineUsers.filter((id) => id !== userId)
        })),

    initializeSocket: (teamId) => {
        // We do NOT subscribe here anymore. Subscription is handled by state changes.
        // socketService.subscribeToTeam(teamId); 

        const store = get() as TeamStore;

        const offUserOnline = socketService.on(
            'user:online',
            (payload: { teamId: string; userId: string }) => {
                const isSameTeam = payload.teamId === teamId;
                if (!isSameTeam) return;

                store.addOnlineUser(payload.userId);
            }
        );

        const offUserOffline = socketService.on(
            'user:offline',
            (payload: { teamId: string; userId: string }) => {
                const isSameTeam = payload.teamId === teamId;
                if (!isSameTeam) return;

                store.removeOnlineUser(payload.userId);
            }
        );

        const offPresenceList = socketService.on(
            'user:list',
            (payload: { teamId: string; users: { _id: string }[] }) => {
                const isSameTeam = payload.teamId === teamId;
                if (!isSameTeam) return;

                const onlineUserIds = payload.users.map((user) => user._id);
                store.setOnlineUsers(onlineUserIds);
            }
        );

        return () => {
            offUserOnline();
            offUserOffline();
            offPresenceList();
            // Do NOT unsubscribe from the team
        };
    }
});
