import { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export interface GetTeamInvitationByIdInputDTO{
    invitationId: string;
};

export interface GetTeamInvitationByIdOutputDTO extends TeamInvitationProps{}