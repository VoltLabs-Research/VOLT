import type { Team } from '@/types/models';

export interface TeamState {
    teams: Team[];
    selectedTeam: Team | null;
    isLoading: boolean;
    error: string | null;

    // Members & Presence
    members: TeamMember[];
    admins: TeamMember[];
    owner: TeamMember | null;
    onlineUsers: string[]; // User IDs
}

export interface TeamMember {
    _id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    lastLoginAt?: string;
    createdAt?: string;
    timeSpentLast7Days?: number;
    trajectoriesCount?: number;
    analysesCount?: number;
    joinedAt?: string;
}

export interface TeamActions {
    getUserTeams: () => Promise<void>;
    setSelectedTeam: (teamId: string) => void;
    createTeam: (data: CreateTeamData) => Promise<Team>;
    updateTeam: (teamId: string, data: UpdateTeamData) => Promise<void>;
    deleteTeam: (teamId: string) => Promise<void>;
    leaveTeam: (teamId: string) => Promise<void>;
    clearError: () => void;
    reset: () => void;

    // Member Actions
    fetchMembers: (teamId: string) => Promise<void>;
    removeMember: (teamId: string, userId: string) => Promise<void>;

    // Presence
    setOnlineUsers: (userIds: string[]) => void;
    addOnlineUser: (userId: string) => void;
    removeOnlineUser: (userId: string) => void;
    initializeSocket: (teamId: string) => () => void;
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
