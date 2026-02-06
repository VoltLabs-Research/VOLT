import { TeamInvitationProps, TeamInvitationStatus } from '@modules/team/domain/entities/TeamInvitation';

export interface UpdateTeamInvitationByIdInputDTO{
    invitationId: string;
    status: TeamInvitationStatus;
};

export interface UpdateTeamInvitationByIdOutputDTO extends TeamInvitationProps{}