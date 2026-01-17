import { TeamInvitationProps } from '../../../domain/entities/TeamInvitation';

export interface CancelInvitationInputDTO {
    teamId: string;
    invitationId: string;
}

export interface CancelInvitationOutputDTO extends TeamInvitationProps {}
