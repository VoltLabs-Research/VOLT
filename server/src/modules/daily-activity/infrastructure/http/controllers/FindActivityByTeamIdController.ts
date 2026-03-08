import { createController } from '@shared/infrastructure/http/controllers/createController';
import FindActivityByTeamIdUseCase from '@modules/daily-activity/application/use-cases/FindActivityByTeamIdUseCase';
import { dailyActivityValidation } from '@modules/daily-activity/infrastructure/http/validation/daily-activity-schemas';

export default createController(FindActivityByTeamIdUseCase, {
    validationSchema: dailyActivityValidation.findByTeamId
});
