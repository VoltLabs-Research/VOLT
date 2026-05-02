export interface PopulatedTeamMemberUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    lastSeenAt?: Date;
    createdAt?: Date;
    isOnline?: boolean;
}

export interface PopulatedTeamMemberRole {
    _id: string;
    name?: string;
    permissions?: string[];
    isSystem?: boolean;
}

export interface TeamMemberProps {
    team: string | { _id: string };
    user: string | PopulatedTeamMemberUser;
    role: string | PopulatedTeamMemberRole;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const isPopulatedTeamMemberUser = (value: TeamMemberProps['user']): value is PopulatedTeamMemberUser => (
    typeof value !== 'string'
);

export const isPopulatedTeamMemberRole = (value: TeamMemberProps['role']): value is PopulatedTeamMemberRole => (
    typeof value !== 'string'
);

export const getTeamMemberUserId = (value: TeamMemberProps['user']): string => {
    if (typeof value === 'string') {
        return value;
    }

    return value._id;
};

export const getTeamMemberRoleId = (value: TeamMemberProps['role']): string => {
    if (typeof value === 'string') {
        return value;
    }

    return value._id;
};

export const getTeamMemberRolePermissions = (value: TeamMemberProps['role']): string[] => {
    if (!isPopulatedTeamMemberRole(value)) {
        return [];
    }

    return value.permissions ?? [];
};

export default class TeamMember {
    constructor(
        public _id: string,
        public props: TeamMemberProps
    ){}

    public get id(): string {
        return this._id;
    }
}
