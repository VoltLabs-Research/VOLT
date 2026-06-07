import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';
import { createController } from '@shared/infrastructure/http/controllers/createController';

const RemoveTeamRunningJobsController = createController(RemoveTeamRunningJobsUseCase, {
});
const RetryTeamFailedJobsController = createController(RetryTeamFailedJobsUseCase, {
});

export default createControllerRegistry({
    removeRunningJobs: RemoveTeamRunningJobsController,
    retryFailedJobs: RetryTeamFailedJobsController
});
