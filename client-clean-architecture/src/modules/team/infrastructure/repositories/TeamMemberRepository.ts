import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { ITeamMemberRepository } from '../../domain/repositories';
import type { TeamMembersResponse, TeamMember } from '../../domain/entities';

export class TeamMemberRepository extends BaseRepository implements ITeamMemberRepository {
    constructor() {
        super('/team/members', { useRBAC: true });
    }

    async getAll(): Promise<TeamMembersResponse> {
        // The API returns the data directly, not nested in another 'data' property
        // But BaseRepository.get unwrap response.data.data
        // Original: response.data.data -> result
        // result.data -> memberStats
        // So we expect BaseRepository.get to return `result`.
        const result = await this.get<any>('/');
        const memberStats = result.data;

        const ownerMember = memberStats.find((member: TeamMember) => member.role && typeof member.role !== 'string' && member.role.name === 'Owner');
        const adminMembers = memberStats.filter((member: TeamMember) => member.role && typeof member.role !== 'string' && member.role.name === 'Admin') ?? [];

        return {
            members: memberStats,
            admins: adminMembers,
            owner: ownerMember ?? null
        };
    }

    async update(memberId: string, data: Record<string, any>): Promise<TeamMember> {
        return this.patch<TeamMember>(`/${memberId}`, data);
    }
}

export const teamMemberRepository = new TeamMemberRepository();
