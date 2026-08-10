import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import ScriptingSessionService from '@modules/scripting/services/ScriptingSessionService';
import type {
    CreateScriptingNotebookInput,
    ListScriptingNotebooksInput,
    NotebookRefInput,
    StartScriptingJupyterSessionInput,
    UpdateScriptingNotebookInput
} from '@volt/contracts/modules/scripting/ai-tools';

export default class ScriptingAIToolController extends AIToolController {
    #service = new ScriptingService();
    #sessions = new ScriptingSessionService();

    @AITool({
        name: 'create_scripting_notebook',
        description: 'Create a new scripting Jupyter notebook.',
        parameters: typia.llm.parameters<CreateScriptingNotebookInput>(),
        validate: typia.createValidate<CreateScriptingNotebookInput>()
    })
    createScriptingNotebook(input: CreateScriptingNotebookInput & AIToolScope) {
        return this.#service.createNotebook(input);
    }

    @AITool({
        name: 'list_scripting_notebooks',
        description: 'List scripting Jupyter notebooks in the team.',
        parameters: typia.llm.parameters<ListScriptingNotebooksInput>(),
        validate: typia.createValidate<ListScriptingNotebooksInput>()
    })
    async listScriptingNotebooks(input: ListScriptingNotebooksInput & AIToolScope) {
        const { total, data } = await this.#service.listNotebooks(input);
        return {
            summary: `Found ${total} scripting notebooks.`,
            data
        };
    }

    @AITool({
        name: 'update_scripting_notebook',
        description: 'Update a scripting Jupyter notebook.',
        parameters: typia.llm.parameters<UpdateScriptingNotebookInput>(),
        validate: typia.createValidate<UpdateScriptingNotebookInput>()
    })
    updateScriptingNotebook(input: UpdateScriptingNotebookInput & AIToolScope) {
        return this.#service.updateNotebook(input);
    }

    @AITool({
        name: 'delete_scripting_notebook',
        description: 'Delete a scripting Jupyter notebook.',
        parameters: typia.llm.parameters<NotebookRefInput>(),
        validate: typia.createValidate<NotebookRefInput>()
    })
    deleteScriptingNotebook(input: NotebookRefInput & AIToolScope) {
        return this.#service.deleteNotebook(input);
    }

    @AITool({
        name: 'start_scripting_jupyter_session',
        description: 'Start a Jupyter session for a scripting notebook.',
        parameters: typia.llm.parameters<StartScriptingJupyterSessionInput>(),
        validate: typia.createValidate<StartScriptingJupyterSessionInput>()
    })
    async startScriptingJupyterSession(input: StartScriptingJupyterSessionInput & AIToolScope) {
        const session = await this.#sessions.createJupyterSession(input);
        return {
            summary: `Jupyter session started for notebook ${session.notebookId}.`,
            data: session
        };
    }

    @AITool({
        name: 'get_scripting_session_status',
        description: 'Get the Jupyter session status for a scripting notebook.',
        parameters: typia.llm.parameters<NotebookRefInput>(),
        validate: typia.createValidate<NotebookRefInput>()
    })
    async getScriptingSessionStatus(input: NotebookRefInput & AIToolScope) {
        const session = await this.#sessions.getSessionStatus(input);
        return {
            summary: `Session ${session.jupyter.ready ? 'ready' : 'not ready'} for notebook ${session.notebookId}.`,
            data: session
        };
    }

    @AITool({
        name: 'stop_scripting_session',
        description: 'Stop the Jupyter session for a scripting notebook.',
        parameters: typia.llm.parameters<NotebookRefInput>(),
        validate: typia.createValidate<NotebookRefInput>()
    })
    async stopScriptingSession(input: NotebookRefInput & AIToolScope) {
        const session = await this.#sessions.deleteSession(input);
        return {
            summary: `Session ${session.deleted ? 'stopped' : 'not running'} for notebook ${session.notebookId}.`,
            data: session
        };
    }
}
