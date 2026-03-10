import controllers from '@modules/daily-activity/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/daily-activities/:teamId',
    resource: Resource.DAILY_ACTIVITY,
    middleware: RATE_LIMIT_POLICIES.dailyActivityRead,
    routes: (router) => {
        router.get('/', controllers.getByTeamId.handle);
    }
});
