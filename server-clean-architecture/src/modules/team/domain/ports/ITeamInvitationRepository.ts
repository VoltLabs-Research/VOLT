import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import TeamInvitation, { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps>{
}