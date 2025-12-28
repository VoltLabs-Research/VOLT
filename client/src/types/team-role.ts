export interface TeamRole {
    _id: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    team: string;
    createdAt: string;
    updatedAt: string;
}

export interface TeamRolePayload {
    name: string;
    permissions: string[];
}

export interface TeamMemberWithRole {
    _id: string;
    user: {
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatar?: string;
    } | string; // Can be populated object or just ID string
    role?: TeamRole; // Optional - may not be populated
    joinedAt: string;
}

