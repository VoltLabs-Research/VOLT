import TeamInvitation, { TeamInvitationProps, TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps>{
    findByToken(token: string): Promise<TeamInvitation | null>;
    findPendingByTeam(teamId: string): Promise<TeamInvitation[]>;
    updateStatus(token: string, status: TeamInvitationStatus): Promise<void>;
};
