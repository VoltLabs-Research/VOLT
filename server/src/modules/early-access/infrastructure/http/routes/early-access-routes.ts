import EarlyAccessController from '@modules/early-access/infrastructure/http/controllers/EarlyAccessController';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import { container } from 'tsyringe';

const controller = container.resolve(EarlyAccessController);

export default createHttpModule({
    moduleKey: 'early-access',
    basePath: '/api/early-access',
    protected: false,
    routes: (router) => {
        router.post(
            '/teams/:teamId/subscriptions',
            RATE_LIMIT_POLICIES.earlyAccessPublic,
            controller.createSubscription
        );
    }
});
