import { paginated, get } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SimulationCell } from '../../entities/simulation-cell';
import type { GetSimulationCellsParams } from '../../dtos/get-simulation-cells';
import type { GetSimulationCellByTrajectoryParams } from '../../dtos/get-simulation-cell-by-trajectory';

const endpoints = {
    getAll: paginated<GetSimulationCellsParams | undefined, PaginatedResponse<SimulationCell>>('/'),
    getByTrajectory: get<GetSimulationCellByTrajectoryParams, SimulationCell | null>(
        '/by-trajectory/:trajectoryId', {
            query: ({ timestep }) => timestep === undefined ? undefined : { timestep }
        }
    )
};

export default endpoints;
