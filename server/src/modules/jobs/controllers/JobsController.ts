import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import JobsService from '@modules/jobs/services/JobsService';
import { jobsRoutes } from '@volt/contracts/modules/jobs/routes';

/**
 * The single HTTP controller for the jobs module (pollium style): every route is
 * bound with `@Route(jobsRoutes.x)` and delegates to a {@link JobsService} the
 * controller `new`s itself. The class-level `@Middleware(protect, teamScoped(Resource.TRAJECTORY))`
 * replaces the old mount-time auth + team-scope layer — note the guard resource
 * is TRAJECTORY (matching `createHttpModule({ basePath: '/api/jobs/:teamId', resource: Resource.TRAJECTORY })`),
 * not a jobs-specific resource. Both endpoints returned 200, so no `@Status`
 * override is needed. `buildRouter()` turns the decorated methods into the
 * Express router mounted directly in `mount-http-routes`.
 */
@Middleware(protect, teamScoped(Resource.TRAJECTORY))
export default class JobsController extends Controller {
    #service = new JobsService();

    @Route(jobsRoutes.removeRunningJobs)
    removeRunningJobs(@Param('teamId') teamId: string, @Param('trajectoryId') trajectoryId: string) {
        return this.#service.removeRunningJobs({ teamId, trajectoryId });
    }

    @Route(jobsRoutes.retryFailedJobs)
    retryFailedJobs(@Param('teamId') teamId: string, @Param('trajectoryId') trajectoryId: string) {
        return this.#service.retryFailedJobs({ teamId, trajectoryId });
    }
}
