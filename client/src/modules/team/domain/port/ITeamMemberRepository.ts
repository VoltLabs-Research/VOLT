import type { TeamMember } from '../entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export interface GetTeamMembersParams {
    page: number;
    limit: number;
};

export interface UpdateTeamMemberParams {
    role?: string;
};

export default interface ITeamMemberRepository {
    getAll(teamId: string, params: GetTeamMembersParams): Promise<PaginatedResponse<TeamMember>>;
    update(teamId: string, memberId: string, data: UpdateTeamMemberParams): Promise<TeamMember>;
    remove(teamId: string, userId: string): Promise<void>;
};
