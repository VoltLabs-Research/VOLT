import CreateScriptingJupyterSessionController from './CreateScriptingJupyterSessionController';
import DeleteScriptingNotebookController from './DeleteScriptingNotebookController';
import ListScriptingNotebooksController from './ListScriptingNotebooksController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    createJupyterSession: CreateScriptingJupyterSessionController,
    deleteNotebook: DeleteScriptingNotebookController,
    listNotebooks: ListScriptingNotebooksController
});