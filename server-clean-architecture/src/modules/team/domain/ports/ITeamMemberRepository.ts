import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import TeamMember, { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';

export interface ITeamMemberRepository extends IBaseRepository<TeamMember, TeamMemberProps>{

};