import { TeamProps } from '../../../domain/entities/Team';

export interface AcceptTeamInvitationInputDTO {
    invitationId: string;
    userId: string;
    userEmail: string;
}

export interface AcceptTeamInvitationOutputDTO extends TeamProps {}
