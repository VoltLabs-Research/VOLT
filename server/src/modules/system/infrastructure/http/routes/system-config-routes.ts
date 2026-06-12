import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { getEnabledModules } from '@core/bootstrap/module-state';

const mode = process.env.DEPLOYMENT_MODE === 'local' ? 'local' : 'cloud';

// Public, unauthenticated: the client reads this at boot to decide single-tenant UI
// and to hide routes/nav for modules this deployment doesn't run.
// Shares the /api/system base path with the protected system module, so it MUST be
// registered before it (see mount-http-routes) to bypass that module's `protect`.
export default createHttpModule({
    moduleKey: 'system',
    basePath: '/api/system',
    protected: false,
    routes: (router) => {
        router.get('/config', (_req, res) => {
            // Return the RESOLVED enabled set the server actually mounted (kernel
            // force-included + `requires` transitively closed), NOT the raw
            // VOLT_MODULES seed — otherwise the client would hide routes whose
            // endpoints are live. Reuses the cached boot-time set so client and
            // server agree exactly on what is enabled.
            const enabledModules = [...getEnabledModules()].sort();

            BaseResponse.success(res, { mode, enabledModules });
        });
    }
});
