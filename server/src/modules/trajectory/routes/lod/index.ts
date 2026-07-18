import { Resource } from '@core/constants/resources';
import TrajectoryController from '@modules/trajectory/controllers/TrajectoryController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TrajectoryController);

export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/lod/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/:analysisId/:exposureId/octree-metadata', controller.lodGetOctreeMetadata);
    }
});
