import { TeamInvitationStatus } from '@volt/contracts/modules/team/domain';

export { TeamInvitationStatus };

interface TeamInvitationProps{
    team: string;
    invitedBy: string;
    invitedUser: string | null;
    email: string;
    token: string;
    role: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    status: TeamInvitationStatus;
    createdAt: Date;
    updatedAt: Date;
}

export const isTeamInvitationExpired = (invitation: Pick<TeamInvitationProps, 'expiresAt'>): boolean => (
    new Date() > invitation.expiresAt
);

export const isTeamInvitationPending = (invitation: Pick<TeamInvitationProps, 'status'>): boolean => (
    invitation.status === TeamInvitationStatus.Pending
);

export const normalizeInvitationEmail = (email: string): string => email.trim().toLowerCase();
