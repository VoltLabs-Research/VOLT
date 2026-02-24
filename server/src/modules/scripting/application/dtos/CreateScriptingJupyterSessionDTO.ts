export interface CreateScriptingJupyterSessionInputDTO {
    teamId: string;
    trajectoryId: string;
    userId?: string;
    notebookId?: string;
}

export interface CreateScriptingJupyterSessionOutputDTO {
    jupyter: {
        url: string;
        ready: boolean;
    };
}
