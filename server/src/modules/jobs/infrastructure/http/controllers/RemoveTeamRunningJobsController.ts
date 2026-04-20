import { jobsValidation } from '@modules/jobs/infrastructure/http/validation/jobs-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';

export default createController(RemoveTeamRunningJobsUseCase, {
    validationSchema: jobsValidation.trajectoryAction
});
