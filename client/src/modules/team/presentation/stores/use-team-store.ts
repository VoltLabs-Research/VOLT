import { create } from 'zustand';
import { container } from 'tsyringe';
import type { Team } from '@/modules/team/domain/entities';
import type ITeamStorage from '@/modules/team/domain/port/ITeamStorage';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

interface TeamStore extends BaseSlice {
    teams: Team[];
    selectedTeam: Team | null;
    permissions: string[];
    permissionsTeamId: string | null;
    isPermissionsLoading: boolean;
    setTeams: (teams: Team[]) => void;
    setSelectedTeam: (team: Team | null) => void;
    selectTeamById: (teamId: string) => void;
    setPermissions: (permissions: string[], teamId?: string | null) => void;
    setPermissionsLoading: (isLoading: boolean) => void;
    addTeam: (team: Team) => void;
    updateTeamInList: (teamId: string, updates: Partial<Team>) => void;
    removeTeam: (teamId: string) => void;
    reset: () => void;
};

const initialState = {
    teams: [] as Team[],
    selectedTeam: null as Team | null,
    permissions: [] as string[],
    permissionsTeamId: null as string | null,
    isPermissionsLoading: false,
    ...BASE_SLICE_INITIAL_STATE
};

export const useTeamStore = create<TeamStore>((set, get) => ({
    ...initialState,
    ...createBaseSlice(set),

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

    setPermissions: (permissions, teamId) => {
        const uniquePermissions = Array.from(new Set(permissions));
        const scopedTeamId = teamId ?? get().selectedTeam?._id ?? null;
        set({ permissions: uniquePermissions, permissionsTeamId: scopedTeamId });
    },

    setPermissionsLoading: (isPermissionsLoading) => set({ isPermissionsLoading }),

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

    reset: () => set(initialState)
}));
