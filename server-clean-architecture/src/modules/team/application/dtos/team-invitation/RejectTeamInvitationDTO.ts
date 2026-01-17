import { TeamInvitationProps } from '../../../domain/entities/TeamInvitation';

export interface RejectTeamInvitationInputDTO {
    invitationId: string;
}

export interface RejectTeamInvitationOutputDTO extends TeamInvitationProps {}
