import controllers from '@modules/team/infrastructure/http/controllers/secret-key';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/secret-keys',
    protected: true,
    routes: (router) => {
        router.get('/me', controllers.current.handle);
    }
});
