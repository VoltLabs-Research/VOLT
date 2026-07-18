import SecretKeyController from '@modules/team/infrastructure/http/controllers/secret-key/SecretKeyController';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(SecretKeyController);

export default createHttpModule({
    moduleKey: 'team',
    basePath: '/api/teams/secret-keys',
    protected: true,
    routes: (router) => {
        router.get('/me', controller.current);
    }
});
