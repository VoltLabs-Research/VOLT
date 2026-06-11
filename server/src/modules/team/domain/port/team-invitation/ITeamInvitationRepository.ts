import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type TeamInvitation from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import type { TeamInvitationProps, TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps> {
    findByToken(token: string): Promise<TeamInvitation | null>;
    findPendingByTeam(teamId: string): Promise<TeamInvitation[]>;
    updateStatus(token: string, status: TeamInvitationStatus): Promise<void>;
}
