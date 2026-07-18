import { Resource } from '@core/constants/resources';
import DailyActivityController from '@modules/daily-activity/infrastructure/http/controllers/DailyActivityController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(DailyActivityController);

export default createHttpModule({
    moduleKey: 'daily-activity',
    basePath: '/api/daily-activities/:teamId',
    resource: Resource.DAILY_ACTIVITY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', controller.getTeamActivitySummary);
    }
});
