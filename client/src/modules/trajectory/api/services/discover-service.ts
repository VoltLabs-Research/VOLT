import { createService, paginated, serviceRoutes } from '@/app/core/http/utils/create-service';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

export interface DiscoverTeamSummary {
    _id: string;
    name: string;
}

interface DiscoverTeamTrajectoriesMeta {
    team: DiscoverTeamSummary;
}

interface ListPublicTeamTrajectoriesInput {
    teamId: string;
    page: number;
    limit: number;
    search?: string;
}

type ListPublicTeamTrajectoriesResponse = PaginatedResponse<Trajectory> & {
    _meta?: DiscoverTeamTrajectoriesMeta;
};

const routes = serviceRoutes('/public/teams');

const endpoints = {
    listPublicTeamTrajectories: paginated<
        ListPublicTeamTrajectoriesInput,
        ListPublicTeamTrajectoriesResponse
    >(routes.path(trajectoryRoutes.discoverListPublicTrajectories), {
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
            basePath: '/public/teams',
            useRBAC: false
        }
    }
}, endpoints);
