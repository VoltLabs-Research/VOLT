export interface CreateScriptingSessionParams {
    trajectoryId: string;
    notebookId?: string;
    teamClusterId?: string;
};

export interface CreateScriptingNotebookSessionParams {
    notebookId: string;
    teamClusterId?: string;
};
