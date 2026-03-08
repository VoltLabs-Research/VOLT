import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamMember } from '../entities/team-member';

export interface GetTeamMembersParams {
    page: number;
    limit: number;
};

export interface GetTeamMembersInputDTO {
    teamId: string;
    page: number;
    limit: number;
};

export type GetTeamMembersOutputDTO = PaginatedResponse<TeamMember>;
