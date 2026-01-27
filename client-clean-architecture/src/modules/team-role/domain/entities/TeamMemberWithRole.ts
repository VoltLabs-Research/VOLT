import type { TeamRole } from './TeamRole';

export interface TeamMemberWithRole {
    _id: string;
    user: {
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatar?: string;
    } | string;
    role?: TeamRole;
    joinedAt: string;
}
