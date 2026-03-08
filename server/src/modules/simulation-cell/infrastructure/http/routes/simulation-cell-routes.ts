import { Resource } from '@core/constants/resources';
import controllers from '@modules/simulation-cell/infrastructure/http/controllers';
import { createGeneralRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Router } from 'express';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/simulation-cells/:teamId',
    router,
    resource: Resource.SIMULATION_CELL
};

const generalRateLimit = createGeneralRateLimiter(60);

router.use(generalRateLimit);

router.get('/', controllers.listByTeamId.handle);
router.get('/trajectories/:trajectoryId', controllers.getByTrajectory.handle);
router.get('/:simulationCellId', controllers.getById.handle);

export default module;
