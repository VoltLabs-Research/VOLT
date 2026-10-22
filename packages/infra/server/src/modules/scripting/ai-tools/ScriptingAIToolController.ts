import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool, AIToolAccess } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import scriptingService from '@modules/scripting/services/ScriptingService';
import scriptingSessionService from '@modules/scripting/services/ScriptingSessionService';
import type {
    CreateScriptingNotebookInput,
    ListScriptingNotebooksInput,
    NotebookRefInput,
    StartScriptingJupyterSessionInput,
    UpdateScriptingNotebookInput
} from '@volt/contracts/modules/scripting/ai-tools';

export default class ScriptingAIToolController extends AIToolController {
    @AITool({
        name: 'create_scripting_notebook',
        description: 'Create a new scripting Jupyter notebook.',
        parameters: typia.llm.parameters<CreateScriptingNotebookInput>(),
        validate: typia.createValidate<CreateScriptingNotebookInput>(),
        access: AIToolAccess.Write,
        permission: 'scripting:create',
        approval: false
    })
    createScriptingNotebook(input: CreateScriptingNotebookInput & AIToolScope) {
        return scriptingService.createNotebook(input);
    }

    @AITool({
        name: 'list_scripting_notebooks',
        description: 'List scripting Jupyter notebooks in the team.',
        parameters: typia.llm.parameters<ListScriptingNotebooksInput>(),
        validate: typia.createValidate<ListScriptingNotebooksInput>(),
        access: AIToolAccess.Read,
        permission: 'scripting:read'
    })
    async listScriptingNotebooks(input: ListScriptingNotebooksInput & AIToolScope) {
        const { total, data } = await scriptingService.listNotebooks(input);
        return {
            summary: `Found ${total} scripting notebooks.`,
            data
        };
    }

    @AITool({
        name: 'update_scripting_notebook',
        description: 'Update a scripting Jupyter notebook.',
        parameters: typia.llm.parameters<UpdateScriptingNotebookInput>(),
        validate: typia.createValidate<UpdateScriptingNotebookInput>(),
        access: AIToolAccess.Write,
        permission: 'scripting:update'
    })
    updateScriptingNotebook(input: UpdateScriptingNotebookInput & AIToolScope) {
        return scriptingService.updateNotebook(input);
    }

    @AITool({
        name: 'delete_scripting_notebook',
        description: 'Delete a scripting Jupyter notebook.',
        parameters: typia.llm.parameters<NotebookRefInput>(),
        validate: typia.createValidate<NotebookRefInput>(),
        access: AIToolAccess.Write,
        permission: 'scripting:delete'
    })
    deleteScriptingNotebook(input: NotebookRefInput & AIToolScope) {
        return scriptingService.deleteNotebook(input);
    }

    @AITool({
        name: 'start_scripting_jupyter_session',
        description: 'Start a Jupyter session for a scripting notebook.',
        parameters: typia.llm.parameters<StartScriptingJupyterSessionInput>(),
        validate: typia.createValidate<StartScriptingJupyterSessionInput>(),
        access: AIToolAccess.Write,
        permission: 'scripting:create'
    })
    async startScriptingJupyterSession(input: StartScriptingJupyterSessionInput & AIToolScope) {
        const session = await scriptingSessionService.createJupyterSession(input);
        return {
            summary: `Jupyter session started for notebook ${session.notebookId}.`,
            data: session
        };
    }

    @AITool({
        name: 'get_scripting_session_status',
        description: 'Get the Jupyter session status for a scripting notebook.',
        parameters: typia.llm.parameters<NotebookRefInput>(),
        validate: typia.createValidate<NotebookRefInput>(),
        access: AIToolAccess.Read,
        permission: 'scripting:read'
    })
    async getScriptingSessionStatus(input: NotebookRefInput & AIToolScope) {
        const session = await scriptingSessionService.getSessionStatus(input);
        return {
            summary: `Session ${session.jupyter.ready ? 'ready' : 'not ready'} for notebook ${session.notebookId}.`,
            data: session
        };
    }

    @AITool({
        name: 'stop_scripting_session',
        description: 'Stop the Jupyter session for a scripting notebook.',
        parameters: typia.llm.parameters<NotebookRefInput>(),
        validate: typia.createValidate<NotebookRefInput>(),
        access: AIToolAccess.Write,
        permission: 'scripting:update'
    })
    async stopScriptingSession(input: NotebookRefInput & AIToolScope) {
        const session = await scriptingSessionService.deleteSession(input);
        return {
            summary: `Session ${session.deleted ? 'stopped' : 'not running'} for notebook ${session.notebookId}.`,
            data: session
        };
    }
}
