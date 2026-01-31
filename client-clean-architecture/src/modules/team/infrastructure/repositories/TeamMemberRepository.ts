import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import ITeamMemberRepository, { UpdateTeamMemberParams } from '../../domain/ports/ITeamMemberRepository';
import { TeamMember } from '../../domain/entities';

@injectable()
export default class TeamMemberRepository extends BaseRepository implements ITeamMemberRepository{
    constructor(){
        super('/team/members', { useRBAC: false });
    }

    async getAll(teamId: string): Promise<TeamMember[]>{
        const response = await this.client.get<ApiResponse<{ data: TeamMember[] }>>(`/${teamId}`);
        return this.unwrap(response).data;
    }

    async update(teamId: string, memberId: string, data: UpdateTeamMemberParams): Promise<TeamMember>{
        const response = await this.client.patch<ApiResponse<TeamMember>>(`/${teamId}/${memberId}`, data);
        return this.unwrap(response);
    }

    async remove(teamId: string, userId: string): Promise<void>{
        await this.client.post(`/${teamId}/remove`, { userId });
    }
};
