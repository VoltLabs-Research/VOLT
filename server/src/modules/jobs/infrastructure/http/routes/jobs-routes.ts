import { Resource } from '@core/constants/resources';
import controllers from '@modules/jobs/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/jobs/:teamId',
    resource: Resource.TRAJECTORY,
    routes: (router) => {
        router.delete('/history', RATE_LIMIT_POLICIES.jobsMutation, controllers.clearHistory.handle);
        router.delete('/running', RATE_LIMIT_POLICIES.jobsMutation, controllers.removeRunningJobs.handle);
        router.post('/failed/retries', RATE_LIMIT_POLICIES.jobsMutation, controllers.retryFailedJobs.handle);
    }
});
