import type { TeamMembersResponse, TeamMember } from '../entities';

export interface ITeamMemberRepository {
    getAll(): Promise<TeamMembersResponse>;
    update(memberId: string, data: Record<string, any>): Promise<TeamMember>;
}
