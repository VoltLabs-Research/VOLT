import controllers from '@modules/system/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/system',
    protected: true,
    middleware: RATE_LIMIT_POLICIES.systemAccess,
    routes: (router) => {
        router.get('/stats', controllers.getSystemStats.handle);
        router.get('/rbac', controllers.getRbacConfig.handle);
    }
});
