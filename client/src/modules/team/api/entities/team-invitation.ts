import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export enum TeamInvitationStatus {
    Pending = 'pending',
    Accepted = 'accepted',
    Rejected = 'rejected'
}

export interface TeamInvitation extends BaseEntity {
    team: any;
    invitedBy: any;
    invitedUser: any;
    email: string;
    token: string;
    role: string;
    expiresAt: Date;
    acceptedAt?: Date;
    status: TeamInvitationStatus;
};
