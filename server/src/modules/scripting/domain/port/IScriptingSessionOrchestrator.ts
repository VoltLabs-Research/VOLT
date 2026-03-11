export interface DefaultNotebookTemplateContext {
    trajectoryId?: string;
};

export interface ScriptingSessionNotebookInput {
    notebookPath: string;
    content?: Record<string, unknown>;
};

export interface ScriptingSessionJupyterInfo {
    url: string;
    ready: boolean;
};

export interface ScriptingSessionStartInput {
    teamId: string;
    teamClusterId: string;
    trajectoryId?: string;
    userId: string;
    notebook?: ScriptingSessionNotebookInput;
    notebookId?: string;
};

export interface ScriptingSessionStartResult {
    jupyter: ScriptingSessionJupyterInfo;
};

export interface IScriptingSessionOrchestrator {
    startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult>;
    deleteSession(trajectoryId: string): Promise<void>;
    resolveDefaultNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string>;
};
