import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import {
    createScriptingNotebookSchema,
    listScriptingNotebooksSchema,
    notebookRefSchema,
    startScriptingJupyterSessionSchema,
    updateScriptingNotebookSchema,
    type CreateScriptingNotebookInput,
    type ListScriptingNotebooksInput,
    type NotebookRefInput,
    type StartScriptingJupyterSessionInput,
    type UpdateScriptingNotebookInput
} from '@volt/contracts/modules/scripting/ai-tools';

export default class ScriptingAIToolController extends AIToolController {
    #service = new ScriptingService();

    @AITool({
        name: 'create_scripting_notebook',
        description: 'Create a new scripting Jupyter notebook.',
        parameters: createScriptingNotebookSchema
    })
    createScriptingNotebook(input: CreateScriptingNotebookInput & AIToolScope) {
        return this.#service.createNotebook(input);
    }

    @AITool({
        name: 'list_scripting_notebooks',
        description: 'List scripting Jupyter notebooks in the team.',
        parameters: listScriptingNotebooksSchema
    })
    async listScriptingNotebooks(input: ListScriptingNotebooksInput & AIToolScope) {
        const { total, data } = await this.#service.listNotebooks(input);
        return { summary: `Found ${total} scripting notebooks.`, data };
    }

    @AITool({
        name: 'update_scripting_notebook',
        description: 'Update a scripting Jupyter notebook.',
        parameters: updateScriptingNotebookSchema
    })
    updateScriptingNotebook(input: UpdateScriptingNotebookInput & AIToolScope) {
        return this.#service.updateNotebook(input);
    }

    @AITool({
        name: 'delete_scripting_notebook',
        description: 'Delete a scripting Jupyter notebook.',
        parameters: notebookRefSchema
    })
    deleteScriptingNotebook(input: NotebookRefInput & AIToolScope) {
        return this.#service.deleteNotebook(input);
    }

    @AITool({
        name: 'start_scripting_jupyter_session',
        description: 'Start a Jupyter session for a scripting notebook.',
        parameters: startScriptingJupyterSessionSchema
    })
    async startScriptingJupyterSession(input: StartScriptingJupyterSessionInput & AIToolScope) {
        const session = await this.#service.createJupyterSession(input);
        return { summary: `Jupyter session started for notebook ${session.notebookId}.`, data: session };
    }

    @AITool({
        name: 'get_scripting_session_status',
        description: 'Get the Jupyter session status for a scripting notebook.',
        parameters: notebookRefSchema
    })
    async getScriptingSessionStatus(input: NotebookRefInput & AIToolScope) {
        const session = await this.#service.getSessionStatus(input);
        return { summary: `Session ${session.jupyter.ready ? 'ready' : 'not ready'} for notebook ${session.notebookId}.`, data: session };
    }

    @AITool({
        name: 'stop_scripting_session',
        description: 'Stop the Jupyter session for a scripting notebook.',
        parameters: notebookRefSchema
    })
    async stopScriptingSession(input: NotebookRefInput & AIToolScope) {
        const session = await this.#service.deleteSession(input);
        return { summary: `Session ${session.deleted ? 'stopped' : 'not running'} for notebook ${session.notebookId}.`, data: session };
    }
}
