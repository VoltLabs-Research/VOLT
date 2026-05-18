import controllers from '@modules/early-access/infrastructure/http/controllers';
import { earlyAccessValidation } from '@modules/early-access/infrastructure/http/validation/early-access-schemas';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/early-access',
    protected: false,
    routes: (router) => {
        router.post(
            '/teams/:teamId/subscriptions',
            RATE_LIMIT_POLICIES.earlyAccessPublic,
            earlyAccessValidation.createSubscription,
            controllers.createSubscription.handle
        );
    }
});
