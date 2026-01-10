import { PaginatedResult } from "@/src/shared/domain/IBaseRepository";
import { TeamInvitationProps, TeamInvitationStatus } from "../../../domain/entities/TeamInvitation";

export interface ListTeamInvitationsInputDTO{
    teamId: string;
    status?: TeamInvitationStatus;
};

export interface ListTeamInvitationsOutputDTO extends PaginatedResult<TeamInvitationProps>{}