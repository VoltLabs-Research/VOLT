import controllers from '@modules/system/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/system',
    protected: true,
    routes: (router) => {
        router.get('/stats', controllers.getSystemStats.handle);
        router.get('/rbac', controllers.getRbacConfig.handle);
    }
});
