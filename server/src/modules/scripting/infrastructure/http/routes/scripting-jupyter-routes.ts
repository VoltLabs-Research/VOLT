import { ScriptingJupyterProxyService } from '@modules/scripting/infrastructure/services/ScriptingJupyterProxyService';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';
import { container } from 'tsyringe';

const router = Router();
const proxyService = container.resolve(ScriptingJupyterProxyService);

const module: HttpModule = {
    basePath: '/api/jupyter',
    router
};

router.use('/:teamId/notebooks/:runtimeNotebookId', proxyService.proxyHttpRequest);

export default module;
