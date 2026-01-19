import { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export interface SendTeamInvitationInputDTO {
    teamId: string;
    userId: string;
    email: string;
    roleId?: string;
}

export interface SendTeamInvitationOutputDTO extends TeamInvitationProps {}
