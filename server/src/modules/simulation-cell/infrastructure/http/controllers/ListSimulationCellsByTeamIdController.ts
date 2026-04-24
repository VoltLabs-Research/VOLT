import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { TRAJECTORY_POPULATE } from '@shared/application/PopulatePresets';
import { createListByController } from '@shared/infrastructure/http/controllers/createReadController';

const ListSimulationCellsByTeamIdController = createListByController({
    repositoryToken: SimulationCellRepository,
    paginated: true,
    populate: TRAJECTORY_POPULATE,
    validationSchema: simulationCellValidationSchemas.listByTeamId,
    defaultLimit: 10,
    filterBuilder: (params) => {
        const filter: Partial<SimulationCellProps> = {
            team: params.teamId as string
        };

        if (typeof params.trajectoryId === 'string' && params.trajectoryId.length > 0) {
            filter.trajectory = params.trajectoryId;
        }

        if (typeof params.timestep === 'number') {
            filter.timestep = params.timestep;
        }

        return filter;
    }
});

export default ListSimulationCellsByTeamIdController;
