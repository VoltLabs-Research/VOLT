export interface ScriptingSessionJupyter {
    url: string;
    ready: boolean;
};

export interface ScriptingSession {
    jupyter: ScriptingSessionJupyter;
};
