import { Resource } from '@core/constants/resources';
import JobsController from '@modules/jobs/controllers/JobsController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(JobsController);

export default createHttpModule({
    basePath: '/api/jobs/:teamId',
    moduleKey: 'jobs',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.delete('/:trajectoryId/running', controller.removeRunningJobs);
        router.post('/:trajectoryId/failed/retries', controller.retryFailedJobs);
    }
});
