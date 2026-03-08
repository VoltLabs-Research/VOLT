import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import TeamInvitation, { TeamInvitationProps, TeamInvitationStatus } from '@modules/team/domain/entities/TeamInvitation';

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps>{
    findByToken(token: string): Promise<TeamInvitation | null>;
    findPendingByTeam(teamId: string): Promise<TeamInvitation[]>;
    updateStatus(token: string, status: TeamInvitationStatus): Promise<void>;
}