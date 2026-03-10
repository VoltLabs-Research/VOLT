import { Resource } from '@core/constants/resources';
import controllers from '@modules/simulation-cell/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/simulation-cells/:teamId',
    resource: Resource.SIMULATION_CELL,
    middleware: RATE_LIMIT_POLICIES.simulationCellRead,
    routes: (router) => {
        router.get('/', controllers.listByTeamId.handle);
        router.get('/trajectories/:trajectoryId', controllers.getByTrajectory.handle);
        router.get('/:simulationCellId', controllers.getById.handle);
    }
});
