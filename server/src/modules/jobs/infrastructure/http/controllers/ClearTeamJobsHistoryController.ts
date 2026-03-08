import { jobsValidation } from '@modules/jobs/infrastructure/http/validation/jobs-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import ClearTeamJobsHistoryUseCase from '@modules/jobs/application/use-cases/ClearTeamJobsHistoryUseCase';

export default createController(ClearTeamJobsHistoryUseCase, {
    validationSchema: jobsValidation.teamAction
});
