import CreateScriptingJupyterSessionController from './CreateScriptingJupyterSessionController';
import DeleteScriptingNotebookController from './DeleteScriptingNotebookController';
import ListScriptingNotebooksController from './ListScriptingNotebooksController';
import { container } from 'tsyringe';

export default {
    createJupyterSession: container.resolve(CreateScriptingJupyterSessionController),
    deleteNotebook: container.resolve(DeleteScriptingNotebookController),
    listNotebooks: container.resolve(ListScriptingNotebooksController)
};
