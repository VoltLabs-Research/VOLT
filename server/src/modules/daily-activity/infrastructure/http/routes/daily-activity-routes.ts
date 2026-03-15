import controllers from '@modules/daily-activity/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/daily-activities/:teamId',
    resource: Resource.DAILY_ACTIVITY,
    routes: (router) => {
        router.get('/', controllers.getByTeamId.handle);
    }
});
