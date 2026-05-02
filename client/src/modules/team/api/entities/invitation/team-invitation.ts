import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/api/entities/user';
import type { Team } from '@/modules/team/api/entities/team/team';

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
