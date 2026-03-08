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

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

export const isPopulatedTeamMemberUser = (value: TeamMemberProps['user']): value is PopulatedTeamMemberUser => {
    return isRecord(value) && '_id' in value;
};

export const isPopulatedTeamMemberRole = (value: TeamMemberProps['role']): value is PopulatedTeamMemberRole => {
    return isRecord(value) && '_id' in value;
};

export const getTeamMemberUserId = (value: TeamMemberProps['user']): string => {
    if (typeof value === 'string') {
        return value;
    }

    return value._id.toString();
};

export const getTeamMemberRoleId = (value: TeamMemberProps['role']): string => {
    if (typeof value === 'string') {
        return value;
    }

    return value._id.toString();
};

export const getTeamMemberRolePermissions = (value: TeamMemberProps['role']): string[] => {
    if (!isPopulatedTeamMemberRole(value)) {
        return [];
    }

    return value.permissions ?? [];
};

export interface TeamMemberProps {
    team: string | { _id: string };
    user: string | PopulatedTeamMemberUser;
    role: string | PopulatedTeamMemberRole;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export default class TeamMember {
    constructor(
        public _id: string,
        public props: TeamMemberProps
    ){}

    public get id(): string {
        return this._id;
    }

    public getUserId(): string {
        return getTeamMemberUserId(this.props.user);
    }

    public getRoleId(): string {
        return getTeamMemberRoleId(this.props.role);
    }

    public getRolePermissions(): string[] {
        return getTeamMemberRolePermissions(this.props.role);
    }
}
