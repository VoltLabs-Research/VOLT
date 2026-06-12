import controllers from '@modules/session/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    moduleKey: 'session',
    basePath: '/api/sessions',
    protected: true,
    routes: (router) => {
        router.get('/', controllers.getActiveSessions.handle);
        router.delete('/:sessionId', controllers.revokeSessionById.handle);
        router.get('/activity', controllers.getMyLoginActivity.handle);
        router.delete('/', controllers.revokeAllSessions.handle);
    }
});
