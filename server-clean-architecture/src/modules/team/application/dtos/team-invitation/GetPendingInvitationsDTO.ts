import { TeamInvitationProps } from '../../../domain/entities/TeamInvitation';

export interface GetPendingInvitationsInputDTO {
    teamId: string;
}

export interface GetPendingInvitationsOutputDTO {
    invitations: TeamInvitationProps[];
}
