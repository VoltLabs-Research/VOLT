import { create, type StateCreator } from 'zustand';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { Team } from '@/types/models';
import type { ApiResponse } from '@/types/api';

interface TeamState{
    teams: Team[];
    selectedTeam: Team | null;
    isLoading: boolean;
    error: string | null;

    getUserTeams: () => Promise<void>;
    setSelectedTeam: (teamId: string) => void;
    createTeam: (data: { name: string; description?: string }) => Promise<void>;
}

const teamStoreCreator: StateCreator<TeamState> = (set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        teams: [],
        selectedTeam: null,
        isLoading: false,
        error: null,

        getUserTeams: () => asyncAction(() => api.get<ApiResponse<Team[]>>('/teams'), {
            loadingKey: 'isLoading',
            onSuccess: (res) => {
                const teams = res.data.data;
                return {
                    teams,
                    selectedTeam: get().selectedTeam || teams[0] || null
                };
            }
        }),

        setSelectedTeam: (teamId: string) => {
            const teamToSelect = get().teams.find((team) => team._id === teamId);
            set({ selectedTeam: teamToSelect || null });
        },

        createTeam: (data) => asyncAction(() => api.post<ApiResponse<Team>>('/teams', data), {
            loadingKey: 'isLoading',
            onSuccess: (res, state) => {
                const newTeam = res.data.data;
                return { 
                    teams: [...state.teams, newTeam],
                    selectedTeam: newTeam
                };
            }
        }),
    };
};

const useTeamStore = create<TeamState>(teamStoreCreator);

export default useTeamStore;