import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query, Body, schemaBody } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import jobsService from '@modules/jobs/services/JobsService';
import { jobsRoutes } from '@volt/contracts/modules/jobs/routes';
import type { RetryTeamFailedJobsInput } from '@volt/contracts/modules/jobs/http';

@Middleware(protect, teamScoped(Resource.TRAJECTORY))
export default class JobsController extends Controller {
    @Route(jobsRoutes.removeRunningJobs)
    removeRunningJobs(
        @Param('teamId') teamId: string,
        @Query('trajectoryId') trajectoryId: string
    ) {
        return jobsService.removeRunningJobs({
            teamId,
            trajectoryId
        });
    }

    @Route(jobsRoutes.retryFailedJobs)
    retryFailedJobs(
        @Param('teamId') teamId: string,
        @Body(schemaBody(typia.createValidate<RetryTeamFailedJobsInput>())) body: RetryTeamFailedJobsInput
    ){
        return jobsService.retryFailedJobs({
            teamId,
            trajectoryId: body.trajectoryId
        });
    }
}
