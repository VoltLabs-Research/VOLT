import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import TeamInvitation, { TeamInvitationProps, TeamInvitationStatus } from "../entities/TeamInvitation";

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps>{
}