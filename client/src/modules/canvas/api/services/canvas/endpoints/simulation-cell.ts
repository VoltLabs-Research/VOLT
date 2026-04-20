import { get } from '@/app/core/http/utilities/create-service';
import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';
import type { GetSimulationCellByTrajectoryParams } from '@/modules/simulation-cell/api/dtos/get-simulation-cell-by-trajectory';

export default {
    getSimulationCell: get<GetSimulationCellByTrajectoryParams, SimulationCell | null>(
        '/:trajectoryId/simulation-cell',
        {
            omit: ['trajectoryId'],
            query: ({ timestep }) => timestep === undefined ? undefined : { timestep }
        }
    )
};
