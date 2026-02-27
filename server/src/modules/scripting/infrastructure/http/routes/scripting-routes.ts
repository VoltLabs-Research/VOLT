import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import CreateScriptingJupyterSessionController from '@modules/scripting/infrastructure/http/controllers/scripting/CreateScriptingJupyterSessionController';
import ListScriptingNotebooksController from '@modules/scripting/infrastructure/http/controllers/scripting/ListScriptingNotebooksController';
import DeleteScriptingNotebookController from '@modules/scripting/infrastructure/http/controllers/scripting/DeleteScriptingNotebookController';
import type { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const listScriptingNotebooksController = container.resolve(ListScriptingNotebooksController);
const createScriptingJupyterSessionController = container.resolve(CreateScriptingJupyterSessionController);
const deleteScriptingNotebookController = container.resolve(DeleteScriptingNotebookController);
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router,
    resource: Resource.PLUGIN
};

router.use(protect);

router.get('/scripting/notebooks', listScriptingNotebooksController.handle);
router.get('/scripting/:trajectoryId/notebooks', listScriptingNotebooksController.handle);
router.post('/scripting/:trajectoryId/jupyter-session', createScriptingJupyterSessionController.handle);
router.delete('/scripting/notebooks/:notebookId', deleteScriptingNotebookController.handle);

export default module;
