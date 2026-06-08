import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';

const mode = process.env.DEPLOYMENT_MODE === 'local' ? 'local' : 'cloud';

// Public, unauthenticated: the client reads this at boot to decide single-tenant UI.
// Shares the /api/system base path with the protected system module, so it MUST be
// registered before it (see mount-http-routes) to bypass that module's `protect`.
export default createHttpModule({
    basePath: '/api/system',
    protected: false,
    routes: (router) => {
        router.get('/config', (_req, res) => {
            BaseResponse.success(res, { mode });
        });
    }
});
