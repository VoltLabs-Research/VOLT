import { create } from 'zustand';
import { container } from 'tsyringe';
import type { Team } from '@/modules/team/domain/entities';
import type ITeamStorage from '@/modules/team/domain/ports/ITeamStorage';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';

interface TeamState{
    teams: Team[];
    selectedTeam: Team | null;
    canInvite: boolean;
    isLoading: boolean;
    error: string | null;
};

interface TeamActions{
    setTeams: (teams: Team[]) => void;
    setSelectedTeam: (team: Team | null) => void;
    selectTeamById: (teamId: string) => void;
    setCanInvite: (canInvite: boolean) => void;
    addTeam: (team: Team) => void;
    updateTeamInList: (teamId: string, updates: Partial<Team>) => void;
    removeTeam: (teamId: string) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type TeamStore = TeamState & TeamActions;

const initialState: TeamState = {
    teams: [],
    selectedTeam: null,
    canInvite: false,
    isLoading: false,
    error: null
};

export const useTeamStore = create<TeamStore>((set, get) => ({
    ...initialState,

    setTeams: (teams) => set({ teams }),

    setSelectedTeam: (team) => {
        if(!team) return;

        const teamStorage = container.resolve<ITeamStorage>(TEAM_TOKENS.TeamStorage);
        teamStorage.setSelectedTeamId(team._id);

        set({ selectedTeam: team });
    },

    selectTeamById: (teamId) => {
        const state = get();
        const team = state.teams.find((t) => t._id === teamId);
        if(team){
            get().setSelectedTeam(team);
        }
    },

    setCanInvite: (canInvite) => set({ canInvite }),

    addTeam: (team) => {
        set((state) => ({
            teams: [team, ...state.teams],
            selectedTeam: team
        }));
        // Note: localStorage write happens in CreateTeamUseCase
    },

    updateTeamInList: (teamId, updates) => {
        set((state) => {
            const teams = state.teams.map((t) => {
                const id = t._id;
                return id === teamId ? { ...t, ...updates } as Team : t;
            });

            const selectedTeamId = state.selectedTeam?._id;
            const selectedTeam = selectedTeamId === teamId
                ? { ...state.selectedTeam, ...updates } as Team
                : state.selectedTeam;

            return { teams, selectedTeam };
        });
    },

    removeTeam: (teamId) => {
        set((state) => {
            const teams = state.teams.filter((t) => t._id !== teamId);

            const selectedTeam = state.selectedTeam?._id === teamId
                ? (teams[0] ?? null)
                : state.selectedTeam;

            if(selectedTeam){
                const teamStorage = container.resolve<ITeamStorage>(TEAM_TOKENS.TeamStorage);
                teamStorage.setSelectedTeamId(selectedTeam._id);
            }

            return { teams, selectedTeam };
        });
    },

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));
