import CreateScriptingJupyterSessionController from './CreateScriptingJupyterSessionController';
import CreateScriptingNotebookController from './CreateScriptingNotebookController';
import DeleteScriptingNotebookController from './DeleteScriptingNotebookController';
import DeleteScriptingSessionController from './DeleteScriptingSessionController';
import GetScriptingSessionStatusController from './GetScriptingSessionStatusController';
import ListScriptingNotebooksController from './ListScriptingNotebooksController';
import UpdateScriptingNotebookController from './UpdateScriptingNotebookController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    createJupyterSession: CreateScriptingJupyterSessionController,
    createNotebook: CreateScriptingNotebookController,
    deleteNotebook: DeleteScriptingNotebookController,
    deleteSession: DeleteScriptingSessionController,
    getSessionStatus: GetScriptingSessionStatusController,
    listNotebooks: ListScriptingNotebooksController,
    updateNotebook: UpdateScriptingNotebookController
});
