import { TeamInvitationProps, TeamInvitationRole } from "../../../domain/entities/TeamInvitation";

export interface CreateTeamInvitationInputDTO{
    teamId: string;
    invitedBy: string;
    invitedUser: string;
    email: string;
    role: TeamInvitationRole;
};

export interface CreateTeamInvitationOutputDTO extends TeamInvitationProps{}