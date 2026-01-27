export interface TeamMemberUser {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    lastLoginAt?: string;
}

export interface TeamMemberRole {
    _id: string;
    name: string;
    isSystem?: boolean;
}

export interface TeamMember {
    _id: string;
    user: TeamMemberUser;
    role?: TeamMemberRole | string;
    joinedAt?: string;
    timeSpentLast7Days?: number;
    trajectoriesCount?: number;
    analysesCount?: number;
}
