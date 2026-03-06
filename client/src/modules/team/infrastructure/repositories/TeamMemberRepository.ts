import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ITeamMemberRepository from '../../domain/port/ITeamMemberRepository';
import type { GetTeamMembersParams, UpdateTeamMemberParams } from '../../domain/port/ITeamMemberRepository';
import type { TeamMember } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class TeamMemberRepository extends BaseRepository implements ITeamMemberRepository {
    constructor() {
        super('/team/members', { useRBAC: false });
    }

    async getAll(teamId: string, params: GetTeamMembersParams): Promise<PaginatedResponse<TeamMember>> {
        return this.getAllPaginated(`/${teamId}`, params);
    }

    async update(teamId: string, memberId: string, data: UpdateTeamMemberParams): Promise<TeamMember> {
        const response = await this.client.patch<ApiResponse<TeamMember>>(`/${teamId}/${memberId}`, data);
        return this.unwrap(response);
    }

    async remove(teamId: string, userId: string): Promise<void> {
        await this.client.post(`/${teamId}/remove`, { userId });
    }
};
