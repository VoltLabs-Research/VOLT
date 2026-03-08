import { Router } from 'express';
import { container } from 'tsyringe';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import CreateScriptingJupyterSessionController from '@modules/scripting/infrastructure/http/controllers/CreateScriptingJupyterSessionController';
import ListScriptingNotebooksController from '@modules/scripting/infrastructure/http/controllers/ListScriptingNotebooksController';
import DeleteScriptingNotebookController from '@modules/scripting/infrastructure/http/controllers/DeleteScriptingNotebookController';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const listScriptingNotebooksController = container.resolve(ListScriptingNotebooksController);
const createScriptingJupyterSessionController = container.resolve(CreateScriptingJupyterSessionController);
const deleteScriptingNotebookController = container.resolve(DeleteScriptingNotebookController);
const module: HttpModule = {
    basePath: '/api/scripting/:teamId',
    router,
    resource: Resource.SCRIPTING
};

const createJupyterSessionRateLimit = createStandardRateLimiter(5);

router.get('/notebooks', listScriptingNotebooksController.handle);
router.get('/:trajectoryId/notebooks', listScriptingNotebooksController.handle);
router.post('/:trajectoryId/jupyter-session', createJupyterSessionRateLimit, createScriptingJupyterSessionController.handle);
router.delete('/notebooks/:notebookId', deleteScriptingNotebookController.handle);

export default module;
