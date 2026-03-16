export interface ScriptingSessionJupyter {
    url: string;
    ready: boolean;
};

export interface ScriptingSession {
    notebookId?: string;
    jupyter: ScriptingSessionJupyter;
};
