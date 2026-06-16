import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { getEnabledModules } from '@core/bootstrap/module-state';

const mode = process.env.DEPLOYMENT_MODE === 'local' ? 'local' : 'cloud';

export default createHttpModule({
    moduleKey: 'system',
    basePath: '/api/system',
    protected: false,
    routes: (router) => {
        router.get('/config', (_req, res) => {
            const enabledModules = [...getEnabledModules()].sort();

            BaseResponse.success(res, { mode, enabledModules });
        });
    }
});
