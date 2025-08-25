import { create, type StateCreator } from 'zustand';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { Team } from '@/types/models';
import type { ApiResponse } from '@/types/api';

interface TeamState {
    teams: Team[];
    selectedTeam: Team | null;
    isLoading: boolean;
    error: string | null;
}

interface TeamActions {
    getUserTeams: () => Promise<void>;
    setSelectedTeam: (teamId: string) => void;
    createTeam: (data: CreateTeamData) => Promise<Team>;
    updateTeam: (teamId: string, data: UpdateTeamData) => Promise<void>;
    deleteTeam: (teamId: string) => Promise<void>;
    clearError: () => void;
    reset: () => void;
}

interface CreateTeamData {
    name: string;
    description?: string;
}

interface UpdateTeamData {
    name?: string;
    description?: string;
}

export type TeamStore = TeamState & TeamActions;

const initialState: TeamState = {
    teams: [],
    selectedTeam: null,
    isLoading: false,
    error: null,
};

const useTeamStore = create<TeamState>((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        ...initialState,

        getUserTeams: () => asyncAction(() => api.get<ApiResponse<Team[]>>('/teams'),
            {
                loadingKey: 'isLoading',
                onSuccess: (res) => {
                    const teams = res.data.data;
                    const currentSelected = get().selectedTeam;

                    // Maintain selection if team still exists
                    const selectedTeam = currentSelected && teams.find((t) => t._id === currentSelected._id)
                        ? teams.find((t) => t._id === currentSelected._id)!
                        : teams[0] || null;

                    return {
                        teams,
                        selectedTeam,
                        error: null
                    };
                },
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to load teams'
                })
            }
        ),

        setSelectedTeam: (teamId: string) => {
            const team = get().teams.find((t) => t._id === teamId);
            if(team){
                set({ selectedTeam: team });
            }
        },

        createTeam: (data) => asyncAction(() => api.post<ApiResponse<Team>>('/teams', data),
            {
                loadingKey: 'isLoading',
                onSuccess: (res) => {
                    const newTeam = res.data.data;
                    const currentTeams = get().teams;
                    return {
                       teams: [newTeam, ...currentTeams],
                        selectedTeam: newTeam,
                        error: null,
                    };
                },
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to create team'
                })
            }
        ).then(() => {
            const newTeam = get().teams[0];
            return newTeam;
        }),

        updateTeam: (teamId: string, data: UpdateTeamData) => asyncAction(() => api.patch<ApiResponse<Team>>(`/teams/${teamId}`, data),
            {
                loadingKey: 'isLoading',
                onSuccess: (res) => {
                    const updatedTeam = res.data.data;
                    const currentTeams = get().teams;
                    const currentSelected = get().selectedTeam;
                    const teams = currentTeams.map((team) => team._id === teamId ? updatedTeam : team);
                    const selectedTeam = currentSelected?._id === teamId ? updatedTeam : currentSelected;
                    return { teams, selectedTeam, error: null };
                },
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to update team'
                })
            }
        ),

        deleteTeam: (teamId: string) => asyncAction(() => api.delete(`/teams/${teamId}`),
            {
                loadingKey: 'isLoading',
                onSuccess: () => {
                    const currentTeams = get().teams;
                    const currentSelected = get().selectedTeam;

                    const teams = currentTeams.filter((team) => team._id !== teamId);
                    const selectedTeam = currentSelected?._id === teamId 
                        ? teams[0] || null
                        : currentSelected;
                    
                    return { teams, selectedTeam, error: null };
                },
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to delete team'
                })
            }
        ),

        clearError: () => set({ error: null }),

        reset: () => set(initialState)
    };
});

export default useTeamStore;