import { create } from 'zustand';
import { container } from 'tsyringe';
import type { Team } from '@/modules/team/domain/entities';
import type ITeamStorage from '@/modules/team/domain/port/ITeamStorage';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import { useTeamInvitationStore } from '@/modules/team/presentation/stores/use-team-invitation-store';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import { useTeamPresenceStore } from '@/modules/team/presentation/stores/use-team-presence-store';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';
import { runManualAppCleanup } from '@/shared/utils/app-cleanup-registry';

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

export const resetTeamDependentStores = (): void => {
    useTeamMemberStore.getState().reset();
    useTeamRoleStore.getState().reset();
    useTeamInvitationStore.getState().reset();
    useTeamPresenceStore.getState().reset();
};

const getCurrentPathname = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.location.pathname;
};

export const resetTeamScopedApplicationState = (): void => {
    const currentPathname = getCurrentPathname();
    runManualAppCleanup(currentPathname, currentPathname);
    resetTeamDependentStores();
};

export const resetTeamSessionState = (): void => {
    const currentPathname = getCurrentPathname();
    runManualAppCleanup(currentPathname, null);
    const teamStorage = container.resolve<ITeamStorage>(TEAM_TOKENS.TeamStorage);
    const teamState = useTeamStore.getState();
    const teamIds = new Set(teamState.teams.map((team) => team._id));

    if (teamState.selectedTeam?._id) {
        teamIds.add(teamState.selectedTeam._id);
    }

    teamIds.forEach((teamId) => {
        teamStorage.clearTeamPermissions(teamId);
    });

    teamStorage.clearSelectedTeamId();
    useTeamStore.getState().reset();
    resetTeamDependentStores();
};
