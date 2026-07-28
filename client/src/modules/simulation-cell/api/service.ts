import { createService, paginated, get } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { SimulationCell } from '@volt/contracts/modules/simulation-cell/domain';

export interface GetSimulationCellByTrajectoryParams {
    trajectoryId: string;
    timestep?: number;
}

export interface GetSimulationCellsParams {
    page: number;
    limit: number;
    search?: string;
}

const endpoints = {
    getAll: paginated<GetSimulationCellsParams | undefined, PaginatedResponse<SimulationCell>>('/simulation-cells'),
    getByTrajectory: get<GetSimulationCellByTrajectoryParams, SimulationCell | null>(
        '/trajectories/:trajectoryId/simulation-cell', {
            client: 'trajectoryScoped',
            query: ({ timestep }) => timestep === undefined ? undefined : { timestep }
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        },
        trajectoryScoped: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
