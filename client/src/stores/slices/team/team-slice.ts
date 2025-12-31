import type { TeamState, TeamStore } from '@/types/stores/team/team';
import teamApi from '@/services/api/team/team';
import { socketService } from '@/services/websockets/socketio';
import teamMember from '@/services/api/team-member/team-member';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

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

export const createTeamSlice: SliceCreator<TeamStore> = (set, get) => ({
    ...initialState,

    getUserTeams: async () => {
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
            }
        });
    },

    setSelectedTeam: (teamId) => {
        const state = get() as TeamStore;

        const selectedTeam = state.teams.find((team) => team._id === teamId);
        if (!selectedTeam) return;

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
    },

    createTeam: async (data) => {
        return await runRequest(set, get, () => teamApi.create(data), {
            errorFallback: 'Failed to create team',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (createdTeam) =>
                set((state: TeamStore) => ({
                    teams: [createdTeam, ...state.teams],
                    selectedTeam: createdTeam,
                    error: null
                }))
        });
    },

    updateTeam: async (teamId, data) => {
        await runRequest(set, get, () => teamApi.update(teamId, data), {
            errorFallback: 'Failed to update team',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (updatedTeam) =>
                set((state: TeamStore) => {
                    const nextTeams = state.teams.map((team) =>
                        team._id === teamId ? updatedTeam : team
                    );

                    const nextSelectedTeam =
                        state.selectedTeam?._id === teamId ? updatedTeam : state.selectedTeam;

                    return {
                        teams: nextTeams,
                        selectedTeam: nextSelectedTeam
                    };
                })
        });
    },

    deleteTeam: async (teamId) => {
        await runRequest(set, get, () => teamApi.delete(teamId), {
            errorFallback: 'Failed to delete team',
            rethrow: true,
            loadingKey: 'isLoading',
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

    fetchMembers: async (_teamId) => {
        await runRequest(set, get, () => teamMember.getAll(), {
            errorFallback: 'Failed to fetch members',
            rethrow: true,
            loadingKey: 'isLoading',
            onSuccess: (data) =>
                set({
                    members: data.members,
                    admins: data.admins,
                    owner: data.owner
                } as Partial<TeamStore>)
        });
    },

    removeMember: async (teamId, userId) => {
        await runRequest(set, get, () => teamApi.members.remove(teamId, { userId }), {
            errorFallback: 'Failed to remove member',
            rethrow: true,
            loadingKey: 'isLoading',
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
        socketService.emit('get_team_presence', { teamId });

        const store = get() as TeamStore;

        const offUserOnline = socketService.on(
            'team_user_online',
            (payload: { teamId: string; userId: string }) => {
                const isSameTeam = payload.teamId === teamId;
                if (!isSameTeam) return;

                store.addOnlineUser(payload.userId);
            }
        );

        const offUserOffline = socketService.on(
            'team_user_offline',
            (payload: { teamId: string; userId: string }) => {
                const isSameTeam = payload.teamId === teamId;
                if (!isSameTeam) return;

                store.removeOnlineUser(payload.userId);
            }
        );

        const offPresenceList = socketService.on(
            'team_presence_list',
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
        };
    }
});
