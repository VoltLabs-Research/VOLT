import { createService, paginated } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

export interface DiscoverTeamSummary {
    _id: string;
    name: string;
}

export interface DiscoverTeamTrajectoriesMeta {
    team: DiscoverTeamSummary;
}

export interface ListPublicTeamTrajectoriesInputDTO {
    teamId: string;
    page: number;
    limit: number;
    search?: string;
}

export type ListPublicTeamTrajectoriesOutputDTO = PaginatedResponse<Trajectory> & {
    _meta?: DiscoverTeamTrajectoriesMeta;
};

const endpoints = {
    listPublicTeamTrajectories: paginated<
        ListPublicTeamTrajectoriesInputDTO,
        ListPublicTeamTrajectoriesOutputDTO
    >('/:teamId/trajectories', {
        omit: ['teamId'],
        query: ({ page, limit, search }) => ({
            page,
            limit,
            ...(search?.trim() ? { search: search.trim() } : {})
        })
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/discover/teams',
            useRBAC: false
        }
    }
}, endpoints);
