export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface ScriptingSessionJupyter {
    url: string;
    ready: boolean;
    containerStage?: NotebookContainerStage;
};

export interface ScriptingSession {
    notebookId?: string;
    jupyter: ScriptingSessionJupyter;
};
