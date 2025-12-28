import type { TeamState, TeamStore } from '@/types/stores/team/team';
import teamApi from '@/services/api/team/team';
import { socketService } from '@/services/websockets/socketio';
import teamMember from '@/services/api/team-member/team-member';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

export const initialState: TeamState = {
    teams: [], selectedTeam: null, isLoading: false, error: null,
    members: [], admins: [], owner: null, onlineUsers: []
};

export const createTeamSlice: SliceCreator<TeamStore> = (set, get) => ({
    ...initialState,

    getUserTeams: async () => {
        await runRequest(set, get, () => teamApi.getAll(), {
            errorFallback: 'Failed to load teams', rethrow: true,
            onSuccess: (teams) => {
                const s = get() as TeamStore;
                const storedId = typeof window !== 'undefined' ? localStorage.getItem('selectedTeamId') : null;
                let selected = storedId ? teams.find(t => t._id === storedId) : null;
                if (!selected) selected = s.selectedTeam && teams.find(t => t._id === s.selectedTeam?._id) ? teams.find(t => t._id === s.selectedTeam?._id)! : teams[0] || null;
                set({ teams, selectedTeam: selected, error: null } as Partial<TeamStore>);
            }
        });
    },

    setSelectedTeam: (teamId) => {
        const team = (get() as TeamStore).teams.find(t => t._id === teamId);
        if (team) { set({ selectedTeam: team } as Partial<TeamStore>); if (typeof window !== 'undefined') localStorage.setItem('selectedTeamId', teamId); }
    },

    createTeam: async (data) => {
        return await runRequest(set, get, () => teamApi.create(data), {
            errorFallback: 'Failed to create team', rethrow: true,
            onSuccess: (team) => set((s: TeamStore) => ({ teams: [team, ...s.teams], selectedTeam: team, error: null }))
        });
    },

    updateTeam: async (teamId, data) => {
        await runRequest(set, get, () => teamApi.update(teamId, data), {
            errorFallback: 'Failed to update team', rethrow: true,
            onSuccess: (team) => set((s: TeamStore) => ({ teams: s.teams.map(t => t._id === teamId ? team : t), selectedTeam: s.selectedTeam?._id === teamId ? team : s.selectedTeam }))
        });
    },

    deleteTeam: async (teamId) => {
        await runRequest(set, get, () => teamApi.delete(teamId), {
            errorFallback: 'Failed to delete team', rethrow: true,
            onSuccess: () => set((s: TeamStore) => { const teams = s.teams.filter(t => t._id !== teamId); return { teams, selectedTeam: s.selectedTeam?._id === teamId ? teams[0] || null : s.selectedTeam }; })
        });
    },

    leaveTeam: async (teamId) => {
        await runRequest(set, get, () => teamApi.leave(teamId), {
            errorFallback: 'Failed to leave team', rethrow: true,
            onSuccess: () => set((s: TeamStore) => { const teams = s.teams.filter(t => t._id !== teamId); return { teams, selectedTeam: s.selectedTeam?._id === teamId ? teams[0] || null : s.selectedTeam }; })
        });
    },

    clearError: () => set({ error: null } as Partial<TeamStore>),
    reset: () => set(initialState as TeamStore),

    fetchMembers: async () => {
        await runRequest(set, get, () => teamMember.getAll(), {
            errorFallback: 'Failed to fetch members', rethrow: true,
            onSuccess: (data) => set({ members: data.members, admins: data.admins, owner: data.owner } as Partial<TeamStore>)
        });
    },

    removeMember: async (teamId, userId) => {
        await runRequest(set, get, () => teamApi.members.remove(teamId, { userId }), {
            errorFallback: 'Failed to remove member', rethrow: true,
            onSuccess: () => set((s: TeamStore) => ({ members: s.members.filter(m => m._id !== userId), admins: s.admins.filter(a => a._id !== userId) }))
        });
    },

    setOnlineUsers: (userIds) => set({ onlineUsers: userIds } as Partial<TeamStore>),
    addOnlineUser: (userId) => { const s = get() as TeamStore; if (!s.onlineUsers.includes(userId)) set({ onlineUsers: [...s.onlineUsers, userId] } as Partial<TeamStore>); },
    removeOnlineUser: (userId) => set((s: TeamStore) => ({ onlineUsers: s.onlineUsers.filter(id => id !== userId) })),

    initializeSocket: (teamId) => {
        socketService.emit('get_team_presence', { teamId });
        const s = get() as TeamStore;
        const offs = [
            socketService.on('team_user_online', (p: { teamId: string; userId: string }) => { if (p.teamId === teamId) s.addOnlineUser(p.userId); }),
            socketService.on('team_user_offline', (p: { teamId: string; userId: string }) => { if (p.teamId === teamId) s.removeOnlineUser(p.userId); }),
            socketService.on('team_presence_list', (p: { teamId: string; users: { _id: string }[] }) => { if (p.teamId === teamId) s.setOnlineUsers(p.users.map(u => u._id)); })
        ];
        return () => offs.forEach(off => off());
    }
});
