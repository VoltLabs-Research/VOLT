import { create } from 'zustand';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { Team } from '@/types/models';
import type { TeamState, TeamStore, UpdateTeamData } from '@/types/stores/team/team';
import teamApi from '@/services/api/team';

const initialState: TeamState = {
    teams: [],
    selectedTeam: null,
    isLoading: false,
    error: null,
};

const useTeamStore = create<TeamStore>((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        ...initialState,

        getUserTeams: () => asyncAction(() => teamApi.getAll(),
            {
                loadingKey: 'isLoading',
                onSuccess: (teams) => {
                    const currentSelected = get().selectedTeam;

                    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('selectedTeamId') : null;
                    let selectedTeam = null;

                    if (storedTeamId) {
                        const storedTeam = teams.find((t) => t._id === storedTeamId);
                        if (storedTeam) {
                            selectedTeam = storedTeam;
                        }
                    }

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
            if (team) {
                set({ selectedTeam: team });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('selectedTeamId', teamId);
                }
            }
        },

        createTeam: (data) => asyncAction(() => teamApi.create(data),
            {
                loadingKey: 'isLoading',
                onSuccess: (newTeam) => {
                    const currentTeams = get().teams;
                    return {
                        teams: [newTeam, ...currentTeams],
                        selectedTeam: newTeam,
                        error: null,
                    };
                },
                onError: (error) => {
                    const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to create team';
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

        updateTeam: (teamId: string, data: UpdateTeamData) => asyncAction(() => teamApi.update(teamId, data),
            {
                loadingKey: 'isLoading',
                onSuccess: (updatedTeam) => {
                    const currentTeams = get().teams;
                    const currentSelected = get().selectedTeam;
                    const teams = currentTeams.map((team) => team._id === teamId ? updatedTeam : team);
                    const selectedTeam = currentSelected?._id === teamId ? updatedTeam : currentSelected;
                    return { teams, selectedTeam, error: null };
                },
                onError: (error) => {
                    const errorMessage = error?.context?.serverMessage || error?.message || 'Failed to update team';
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

        deleteTeam: (teamId: string) => asyncAction(() => teamApi.delete(teamId),
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
                    if (error?.context) {
                        error.context.teamId = teamId;
                        error.context.operation = 'deleteTeam';
                    }
                    return {
                        error: errorMessage
                    };
                }
            }),

        leaveTeam: (teamId: string) => asyncAction(() => teamApi.leave(teamId),
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