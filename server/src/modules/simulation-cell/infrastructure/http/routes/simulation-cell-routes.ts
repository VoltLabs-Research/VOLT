import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { canRead } from '@shared/infrastructure/http/middleware/authorization';
import { Resource } from '@core/constants/resources';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import FindCellsByTeamIdController from '@modules/simulation-cell/infrastructure/http/controllers/FindCellsByTeamIdController';
import FindCellByIdController from '@modules/simulation-cell/infrastructure/http/controllers/FindCellByIdController';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const findCellsByTeamIdController = container.resolve<FindCellsByTeamIdController>(SIMULATION_CELL_TOKENS.FindCellsByTeamIdController);
const findCellByIdController = container.resolve<FindCellByIdController>(SIMULATION_CELL_TOKENS.FindCellByIdController);

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/simulation-cell/:teamId',
    router
};

router.use(protect);

router.get('/', canRead(Resource.SIMULATION_CELL), findCellsByTeamIdController.handle);
router.get('/:id', canRead(Resource.SIMULATION_CELL), findCellByIdController.handle);

export default module;
