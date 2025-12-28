import { create } from 'zustand';
import type { TeamState, TeamStore, UpdateTeamData } from '@/types/stores/team/team';
import teamApi from '@/services/api/team';
import { socketService } from '@/services/socketio';

const initialState: TeamState = {
    teams: [],
    selectedTeam: null,
    isLoading: false,
    error: null,
    members: [],
    admins: [],
    owner: null,
    onlineUsers: []
};

const useTeamStore = create<TeamStore>((set, get) => {
    return {
        ...initialState,

        getUserTeams: async () => {
            set({ isLoading: true });

            try{
                const teams = await teamApi.getAll();

                const currentSelected = get().selectedTeam;

                const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('selectedTeamId') : null;
                let selectedTeam = null;

                if(storedTeamId){
                    const storedTeam = teams.find((t) => t._id === storedTeamId);
                    if(storedTeam){
                        selectedTeam = storedTeam;
                    }
                }

                if(!selectedTeam){
                    selectedTeam =
                        currentSelected && teams.find((t) => t._id === currentSelected._id)
                            ? teams.find((t) => t._id === currentSelected._id)!
                            : teams[0] || null;
                }

                set({
                    teams,
                    selectedTeam,
                    error: null
                });
            }catch(error: any){
                const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to load teams';
                if(error?.context){
                    error.context.operation = 'getUserTeams';
                }
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        setSelectedTeam: (teamId: string) => {
            const team = get().teams.find((t) => t._id === teamId);
            if(team){
                set({ selectedTeam: team });
                if(typeof window !== 'undefined'){
                    localStorage.setItem('selectedTeamId', teamId);
                }
            }
        },

        createTeam: async (data) => {
            set({ isLoading: true });

            try{
                const newTeam = await teamApi.create(data);
                const currentTeams = get().teams;

                set({
                    teams: [newTeam, ...currentTeams],
                    selectedTeam: newTeam,
                    error: null
                });

                return newTeam;
            }catch(error: any){
                const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to create team';
                if(error?.context){
                    error.context.operation = 'createTeam';
                }
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        updateTeam: async (teamId: string, data: UpdateTeamData) => {
            set({ isLoading: true });

            try{
                const updatedTeam = await teamApi.update(teamId, data);

                const currentTeams = get().teams;
                const currentSelected = get().selectedTeam;

                const teams = currentTeams.map((team) => team._id === teamId ? updatedTeam : team);
                const selectedTeam = currentSelected?._id === teamId ? updatedTeam : currentSelected;

                set({ teams, selectedTeam, error: null });
            }catch(error: any){
                const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to update team';
                if(error?.context){
                    error.context.teamId = teamId;
                    error.context.operation = 'updateTeam';
                }
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        deleteTeam: async (teamId: string) => {
            set({ isLoading: true });

            try{
                await teamApi.delete(teamId);

                const currentTeams = get().teams;
                const currentSelected = get().selectedTeam;

                const teams = currentTeams.filter((team) => team._id !== teamId);
                const selectedTeam = currentSelected?._id === teamId
                    ? teams[0] || null
                    : currentSelected;

                set({ teams, selectedTeam, error: null });
            }catch(error: any){
                const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to delete team';
                if(error?.context){
                    error.context.teamId = teamId;
                    error.context.operation = 'deleteTeam';
                }
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        leaveTeam: async (teamId: string) => {
            set({ isLoading: true });

            try{
                await teamApi.leave(teamId);

                const currentTeams = get().teams;
                const currentSelected = get().selectedTeam;

                const teams = currentTeams.filter((team) => team._id !== teamId);
                const selectedTeam = currentSelected?._id === teamId
                    ? teams[0] || null
                    : currentSelected;

                set({ teams, selectedTeam, error: null });
            }catch(error: any){
                const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to leave team';
                if(error?.context){
                    error.context.teamId = teamId;
                    error.context.operation = 'leaveTeam';
                }
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        clearError: () => set({ error: null }),

        reset: () => set(initialState),

        fetchMembers: async (teamId: string) => {
            set({ isLoading: true });

            try{
                const data = await teamApi.members.getAll(teamId);
                console.log(data);
                set({
                    members: data.members,
                    admins: data.admins,
                    owner: data.owner,
                    error: null
                });
            }catch(error: any){
                set({ error: error.message || 'Failed to fetch members' });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        removeMember: async (teamId, userId) => {
            set({ isLoading: true });

            try{
                await teamApi.members.remove(teamId, { userId });

                const { members, admins } = get();
                set({
                    members: members.filter(m => m._id !== userId),
                    admins: admins.filter(a => a._id !== userId),
                    error: null
                });
            }catch(error: any){
                set({ error: error.message || 'Failed to remove member' });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

        addOnlineUser: (userId) => {
            const current = get().onlineUsers;
            if(!current.includes(userId)) set({ onlineUsers: [...current, userId] });
        },

        removeOnlineUser: (userId) => {
            const current = get().onlineUsers;
            set({ onlineUsers: current.filter(id => id !== userId) });
        },

        initializeSocket: (teamId: string) => {
            socketService.emit('get_team_presence', { teamId });

            const offOnline = socketService.on('team_user_online', (payload: any) => {
                if(payload.teamId === teamId){
                    get().addOnlineUser(payload.userId);
                }
            });

            const offOffline = socketService.on('team_user_offline', (payload: any) => {
                if(payload.teamId === teamId){
                    get().removeOnlineUser(payload.userId);
                }
            });

            const offList = socketService.on('team_presence_list', (payload: any) => {
                if(payload.teamId === teamId){
                    get().setOnlineUsers(payload.users.map((u: any) => u._id));
                }
            });

            return () => {
                offOnline();
                offOffline();
                offList();
            };
        }
    };
});

export const getCurrentTeamId = (): string | null => {
    return useTeamStore.getState().selectedTeam?._id ?? null;
};

export default useTeamStore;
