import SimulationCellController from '@modules/simulation-cell/controllers/SimulationCellController';
import { Resource } from '@core/constants/resources';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(SimulationCellController);

export default createHttpModule({
    basePath: '/api/simulation-cells/:teamId',
    resource: Resource.SIMULATION_CELL,
    moduleKey: 'simulation-cell',
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', controller.list);
        router.get('/trajectories/:trajectoryId', controller.getByTrajectory);
        router.get('/:simulationCellId', controller.getById);
    }
});
