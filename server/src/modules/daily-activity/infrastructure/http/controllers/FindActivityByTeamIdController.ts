import { dailyActivityValidation } from '@modules/daily-activity/infrastructure/http/validation/daily-activity-schemas';
import FindActivityByTeamIdUseCase from '@modules/daily-activity/application/use-cases/FindActivityByTeamIdUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(FindActivityByTeamIdUseCase, {
    validationSchema: dailyActivityValidation.findByTeamId
});
