import { TeamInvitationProps } from '../../../domain/entities/TeamInvitation';

export interface SendTeamInvitationInputDTO {
    teamId: string;
    invitedByUserId: string;
    email: string;
    role: string;
}

export interface SendTeamInvitationOutputDTO extends TeamInvitationProps {}
