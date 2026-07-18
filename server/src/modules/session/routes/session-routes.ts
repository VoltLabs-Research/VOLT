import SessionController from '@modules/session/controllers/SessionController';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(SessionController);

export default createHttpModule({
    moduleKey: 'session',
    basePath: '/api/sessions',
    protected: true,
    routes: (router) => {
        router.get('/', controller.getActiveSessions);
        router.delete('/:sessionId', controller.revokeSessionById);
        router.get('/activity', controller.getMyLoginActivity);
        router.delete('/', controller.revokeAllSessions);
    }
});
