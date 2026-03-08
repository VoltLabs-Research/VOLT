export interface ScriptingSessionStartInput {
    teamId: string;
    trajectoryId: string;
    userId: string;
    notebook?: {
        notebookPath: string;
        content?: unknown;
    };
}

export interface ScriptingSessionStartResult {
    jupyter: {
        url: string;
        ready: boolean;
    };
}

export interface IScriptingSessionOrchestrator {
    startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult>;
    deleteSession(trajectoryId: string): Promise<void>;
    resolveDefaultNotebookTemplateContent(context: { trajectoryId: string }): Promise<string>;
}
