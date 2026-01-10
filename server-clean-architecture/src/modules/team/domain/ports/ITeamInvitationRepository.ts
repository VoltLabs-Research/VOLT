import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import TeamInvitation, { TeamInvitationProps, TeamInvitationStatus } from "../entities/TeamInvitation";

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps>{
    /**
     * Find team invitation by token.
     */
    findByToken(token: string): Promise<TeamInvitation | null>;

    /**
     * Find all pending invitations for a specified team.
     */
    findPendingByTeam(teamId: string): Promise<TeamInvitation[]>;

    /**
     * Update invitation status by token.
     */
    updateStatus(token: string, status: TeamInvitationStatus): Promise<void>;
}