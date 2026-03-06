import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import TeamInvitation, { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export interface ITeamInvitationRepository extends IBaseRepository<TeamInvitation, TeamInvitationProps>{
}