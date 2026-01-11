import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import TeamInvitation, { TeamInvitationProps } from "../entities/TeamInvitation";

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps>{
}