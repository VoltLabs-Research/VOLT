import { Router } from 'express';
import { container } from 'tsyringe';
import { createGeneralRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import GetSimulationCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByIdController';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import ListSimulationCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/ListSimulationCellsByTeamIdController';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const listSimulationCellsByTeamIdController = container.resolve<InstanceType<typeof ListSimulationCellsByTeamIdController>>(
    SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdController
);
const getSimulationCellByIdController = container.resolve<InstanceType<typeof GetSimulationCellByIdController>>(
    SIMULATION_CELL_TOKENS.GetSimulationCellByIdController
);
const getSimulationCellByTrajectoryController = container.resolve<InstanceType<typeof GetSimulationCellByTrajectoryController>>(
    SIMULATION_CELL_TOKENS.GetSimulationCellByTrajectoryController
);

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/simulation-cells/:teamId',
    router,
    resource: Resource.SIMULATION_CELL
};

const generalRateLimit = createGeneralRateLimiter(60);

router.use(generalRateLimit);

router.get('/', listSimulationCellsByTeamIdController.handle);
router.get('/trajectories/:trajectoryId', getSimulationCellByTrajectoryController.handle);
router.get('/:simulationCellId', getSimulationCellByIdController.handle);

export default module;
