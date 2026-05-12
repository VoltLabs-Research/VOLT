import controllers from '@modules/trajectory/infrastructure/http/controllers/discover';
import { discoverValidation } from '@modules/trajectory/infrastructure/http/validation/discover';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/discover/teams',
    protected: false,
    routes: (router) => {
        router.get(
            '/:teamId/trajectories',
            discoverValidation.listPublicTeamTrajectories,
            controllers.listPublicTeamTrajectories.handle
        );
    }
});
