import TrajectoryController from '@modules/trajectory/infrastructure/http/controllers/TrajectoryController';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TrajectoryController);

export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/discover/teams',
    protected: false,
    routes: (router) => {
        router.get(
            '/:teamId/trajectories',
            controller.discoverListPublicTeamTrajectories
        );
    }
});
