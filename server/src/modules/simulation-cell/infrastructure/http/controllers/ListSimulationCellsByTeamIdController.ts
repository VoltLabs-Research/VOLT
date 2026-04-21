import { createListByController } from '@shared/infrastructure/http/controllers/createReadController';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

const ListSimulationCellsByTeamIdController = createListByController({
    repositoryToken: SIMULATION_CELL_TOKENS.SimulationCellRepository,
    paginated: true,
    populate: { path: 'trajectory', select: ['name'] },
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
