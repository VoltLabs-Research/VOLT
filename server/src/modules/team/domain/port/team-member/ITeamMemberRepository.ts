import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import TeamMember, { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';

export interface ITeamMemberRepository extends IBaseRepository<TeamMember, TeamMemberProps> {
    /**
     * Find all team memberships for a user
     */
    findByUserId(userId: string): Promise<TeamMember[]>;

    /**
     * Delete all team memberships for a user
     */
    deleteByUserId(userId: string): Promise<void>;

    /**
     * Get team IDs for all teams a user belongs to
     */
    getTeamIdsByUserId(userId: string): Promise<string[]>;
};