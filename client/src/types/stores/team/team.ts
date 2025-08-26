import type { Team } from '@/types/models';

export interface TeamState {
    teams: Team[];
    selectedTeam: Team | null;
    isLoading: boolean;
    error: string | null;
}

export interface TeamActions {
    getUserTeams: () => Promise<void>;
    setSelectedTeam: (teamId: string) => void;
    createTeam: (data: CreateTeamData) => Promise<Team>;
    updateTeam: (teamId: string, data: UpdateTeamData) => Promise<void>;
    deleteTeam: (teamId: string) => Promise<void>;
    clearError: () => void;
    reset: () => void;
}

export interface CreateTeamData {
    name: string;
    description?: string;
}

export interface UpdateTeamData {
    name?: string;
    description?: string;
}

export type TeamStore = TeamState & TeamActions;