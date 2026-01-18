import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { canRead } from '@/src/shared/infrastructure/http/middleware/authorization';
import { Resource } from '@/src/core/constants/resources';
import { SIMULATION_CELL_TOKENS } from '../../di/SimulationCellTokens';
import FindCellsByTeamIdController from '../controllers/FindCellsByTeamIdController';
import FindCellByIdController from '../controllers/FindCellByIdController';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

const findCellsByTeamIdController = container.resolve<FindCellsByTeamIdController>(SIMULATION_CELL_TOKENS.FindCellsByTeamIdController);
const findCellByIdController = container.resolve<FindCellByIdController>(SIMULATION_CELL_TOKENS.FindCellByIdController);

const router = Router();
const module: HttpModule = {
    basePath: '/api/simulation-cell/:teamId',
    router
};

router.use(protect);

router.get('/:teamId/', canRead(Resource.SIMULATION_CELL), findCellsByTeamIdController.handle);
router.get('/:teamId/:id', canRead(Resource.SIMULATION_CELL), findCellByIdController.handle);

export default module;
