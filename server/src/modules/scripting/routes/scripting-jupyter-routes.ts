import proxyService from '@modules/scripting/services/ScriptingJupyterProxyService';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    moduleKey: 'scripting',
    basePath: '/api/jupyter',
    routerOptions: { mergeParams: false },
    routes: (router) => {
        router.use('/:teamId/notebooks/:runtimeNotebookId', proxyService.proxyHttpRequest);
    }
});
