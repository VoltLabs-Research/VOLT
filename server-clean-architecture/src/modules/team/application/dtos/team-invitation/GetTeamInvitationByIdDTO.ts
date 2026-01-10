import { TeamInvitationProps } from "../../../domain/entities/TeamInvitation";

export interface GetTeamInvitationByIdInputDTO{
    invitationId: string;
};

export interface GetTeamInvitationByIdOutputDTO extends TeamInvitationProps{}