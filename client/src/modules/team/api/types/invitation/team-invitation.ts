import type { BaseEntity } from '@/shared/types/BaseEntity';
import type { User } from '@/modules/auth/api/types/user';
import type { Team } from '@/modules/team/api/types/team/team';

export enum TeamInvitationStatus {
    Pending = 'pending',
    Accepted = 'accepted',
    Rejected = 'rejected'
}

export interface TeamInvitation extends BaseEntity {
    team: Team;
    invitedBy: User;
    invitedUser: User;
    email: string;
    token: string;
    role: string;
    expiresAt: Date;
    acceptedAt?: Date;
    status: TeamInvitationStatus;
}
