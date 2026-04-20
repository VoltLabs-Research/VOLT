import { jobsValidation } from '@modules/jobs/infrastructure/http/validation/jobs-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';

export default createController(RetryTeamFailedJobsUseCase, {
    validationSchema: jobsValidation.trajectoryAction
});
