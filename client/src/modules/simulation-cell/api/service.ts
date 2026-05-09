import { createService, paginated, get } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SimulationCell } from './entities/simulation-cell';

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
    getAll: paginated<GetSimulationCellsParams | undefined, PaginatedResponse<SimulationCell>>('/'),
    getByTrajectory: get<GetSimulationCellByTrajectoryParams, SimulationCell | null>(
        '/trajectories/:trajectoryId', {
            query: ({ timestep }) => timestep === undefined ? undefined : { timestep }
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/simulation-cells',
            useRBAC: true
        }
    }
}, endpoints);
