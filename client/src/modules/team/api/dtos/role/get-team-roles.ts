import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamRole } from '../../entities/role';

export interface GetTeamRolesParams {
    page: number;
    limit: number;
};

export interface GetTeamRolesInputDTO {
    teamId: string;
    page: number;
    limit: number;
};

export type GetTeamRolesOutputDTO = PaginatedResponse<TeamRole>;
