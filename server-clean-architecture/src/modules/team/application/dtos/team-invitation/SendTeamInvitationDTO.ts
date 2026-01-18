import { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export interface SendTeamInvitationInputDTO {
    teamId: string;
    invitedByUserId: string;
    email: string;
    roleId: string;
}

export interface SendTeamInvitationOutputDTO extends TeamInvitationProps {}
