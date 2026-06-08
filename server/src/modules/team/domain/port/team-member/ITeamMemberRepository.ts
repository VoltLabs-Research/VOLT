import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import TeamMember, { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';

export interface ITeamMemberRepository extends IBaseRepository<TeamMember, TeamMemberProps> {
    findByUserId(userId: string): Promise<TeamMember[]>;

    deleteByUserId(userId: string): Promise<void>;

    getTeamIdsByUserId(userId: string): Promise<string[]>;
}