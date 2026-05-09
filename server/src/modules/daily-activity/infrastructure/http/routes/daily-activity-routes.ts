import { Resource } from '@core/constants/resources';
import { dailyActivityValidation } from '@modules/daily-activity/infrastructure/http/validation/daily-activity-schemas';
import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

export default createHttpModule({
    basePath: '/api/daily-activities/:teamId',
    resource: Resource.DAILY_ACTIVITY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', createValidationMiddleware(dailyActivityValidation.findByTeamId), async (req, res) => {
            const { teamId } = req.params as { teamId: string };
            const { range } = req.query as unknown as { range: number };
            const repository = container.resolve(DailyActivityRepository);

            BaseResponse.success(res, await repository.findActivityByTeamId(teamId, range));
        });
    }
});
