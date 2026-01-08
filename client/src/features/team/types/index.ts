export interface CreateTeamPayload {
    name: string;
    description?: string;
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

export interface TeamMembersResponse {
    members: TeamMember[];
    admins: TeamMember[];
    owner: TeamMember;
}

export interface ActivityItem {
    type: 'TRAJECTORY_UPLOAD' | 'TRAJECTORY_DELETION' | 'ANALYSIS_PERFORMED';
    user: string;
    createdAt: string;
    description: string;
}

export interface ActivityData {
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
}