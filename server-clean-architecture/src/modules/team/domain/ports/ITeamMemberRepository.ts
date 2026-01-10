import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import TeamMember, { TeamMemberProps } from '../entities/TeamMember';

export interface ITeamMemberRepository extends IBaseRepository<TeamMember, TeamMemberProps>{

};