import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import JobsService from '@modules/jobs/services/JobsService';
import { jobsRoutes } from '@volt/contracts/modules/jobs/routes';

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
