import { container } from 'tsyringe';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import ClearTeamJobsHistoryUseCase from '@modules/jobs/application/use-cases/ClearTeamJobsHistoryUseCase';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import { jobsValidation } from '@modules/jobs/infrastructure/http/validation/jobs-schemas';

const ClearTeamJobsHistoryController = createController(ClearTeamJobsHistoryUseCase, {
    validationSchema: jobsValidation.teamAction
});
const RemoveTeamRunningJobsController = createController(RemoveTeamRunningJobsUseCase, {
    validationSchema: jobsValidation.teamAction
});
const RetryTeamFailedJobsController = createController(RetryTeamFailedJobsUseCase, {
    validationSchema: jobsValidation.teamAction
});

export default {
    clearHistory: container.resolve(ClearTeamJobsHistoryController),
    removeRunningJobs: container.resolve(RemoveTeamRunningJobsController),
    retryFailedJobs: container.resolve(RetryTeamFailedJobsController)
};
