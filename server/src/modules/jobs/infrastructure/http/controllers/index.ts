import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { jobsValidation } from '@modules/jobs/infrastructure/http/validation/jobs-schemas';

const RemoveTeamRunningJobsController = createController(RemoveTeamRunningJobsUseCase, {
    validationSchema: jobsValidation.trajectoryAction
});
const RetryTeamFailedJobsController = createController(RetryTeamFailedJobsUseCase, {
    validationSchema: jobsValidation.trajectoryAction
});

export default createControllerRegistry({
    removeRunningJobs: RemoveTeamRunningJobsController,
    retryFailedJobs: RetryTeamFailedJobsController
});
