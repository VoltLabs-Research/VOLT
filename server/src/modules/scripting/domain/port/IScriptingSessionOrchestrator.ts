import type { ScriptingNotebookContainerResources } from '@modules/scripting/domain/entities/ScriptingNotebook';

export interface DefaultNotebookTemplateContext {
    trajectoryId?: string;
}

export interface ScriptingSessionNotebookInput {
    notebookPath: string;
    content?: Record<string, unknown>;
}

export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface ScriptingSessionJupyterInfo {
    url: string;
    ready: boolean;
    containerStage?: NotebookContainerStage;
}

export interface ScriptingSessionStartInput {
    teamId: string;
    teamClusterId: string;
    containerResources: ScriptingNotebookContainerResources;
    userId: string;
    notebook?: ScriptingSessionNotebookInput;
    notebookId?: string;
}

export interface ScriptingSessionStartResult {
    notebookId: string;
    jupyter: ScriptingSessionJupyterInfo;
}

export interface IScriptingSessionOrchestrator {
    startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult>;
    deleteSession(trajectoryId: string): Promise<void>;
    resolveNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<Record<string, unknown>>;
}
