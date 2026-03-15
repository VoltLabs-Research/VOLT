import { Resource } from '@core/constants/resources';
import controllers from '@modules/jobs/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/jobs/:teamId',
    resource: Resource.TRAJECTORY,
    routes: (router) => {
        router.delete('/history', controllers.clearHistory.handle);
        router.delete('/running', controllers.removeRunningJobs.handle);
        router.post('/failed/retries', controllers.retryFailedJobs.handle);
    }
});
