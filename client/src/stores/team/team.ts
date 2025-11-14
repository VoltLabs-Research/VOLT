import { create } from 'zustand';
import { api } from '@/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { Team } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import type { TeamState, TeamStore, UpdateTeamData } from '@/types/stores/team/team';

const initialState: TeamState = {
    teams: [],
    selectedTeam: null,
    isLoading: false,
    error: null,
};

const useTeamStore = create<TeamStore>((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    // Load selected team from localStorage on initialization
    const loadSelectedTeamFromStorage = () => {
        if (typeof window !== 'undefined') {
            const storedTeamId = localStorage.getItem('selectedTeamId');
            if (storedTeamId) {
                const teams = get().teams;
                const team = teams.find(t => t._id === storedTeamId);
                if (team) {
                    set({ selectedTeam: team });
                    return team;
                }
            }
        }
        return null;
    };

    return {
        ...initialState,

        getUserTeams: () => asyncAction(() => api.get<ApiResponse<Team[]>>('/teams'),
            {
                loadingKey: 'isLoading',
                onSuccess: (res) => {
                    const teams = res.data.data;
                    const currentSelected = get().selectedTeam;

                    // Try to load from localStorage first
                    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('selectedTeamId') : null;
                    let selectedTeam = null;

                    if (storedTeamId) {
                        const storedTeam = teams.find((t) => t._id === storedTeamId);
                        if (storedTeam) {
                            selectedTeam = storedTeam;
                        }
                    }

                    // Fallback to current selection or first team
                    if (!selectedTeam) {
                        selectedTeam = currentSelected && teams.find((t) => t._id === currentSelected._id)
                            ? teams.find((t) => t._id === currentSelected._id)!
                            : teams[0] || null;
                    }

                    return {
                        teams,
                        selectedTeam,
                        error: null
                    };
                },
                onError: (error) => {
                    const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to load teams';
                    // Enhance context
                    if (error?.context) {
                        error.context.operation = 'getUserTeams';
                    }
                    return {
                        error: errorMessage
                    };
                }
            }
        ),

        setSelectedTeam: (teamId: string) => {
            const team = get().teams.find((t) => t._id === teamId);
            if(team){
                set({ selectedTeam: team });
                // Save to localStorage
                if (typeof window !== 'undefined') {
                    localStorage.setItem('selectedTeamId', teamId);
                }
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
                onError: (error) => {
                    const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to create team';
                    // Enhance context
                    if (error?.context) {
                        error.context.operation = 'createTeam';
                    }
                    return {
                        error: errorMessage
                    };
                }
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
                onError: (error) => {
                    const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to update team';
                    // Enhance context
                    if (error?.context) {
                        error.context.teamId = teamId;
                        error.context.operation = 'updateTeam';
                    }
                    return {
                        error: errorMessage
                    };
                }
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
                onError: (error) => {
                    const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to delete team';
                    // Enhance context
                    if (error?.context) {
                        error.context.teamId = teamId;
                        error.context.operation = 'deleteTeam';
                    }
                    return {
                        error: errorMessage
                    };
                }
                }),

        leaveTeam: (teamId: string) => asyncAction(() => api.post(`/teams/${teamId}/leave`),
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
                onError: (error) => {
                    const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to leave team';
                    // Enhance context
                    if (error?.context) {
                        error.context.teamId = teamId;
                        error.context.operation = 'leaveTeam';
                    }
                    return {
                        error: errorMessage
                    };
                }
                }),

        clearError: () => set({ error: null }),

        reset: () => set(initialState)
    };
});

export default useTeamStore;