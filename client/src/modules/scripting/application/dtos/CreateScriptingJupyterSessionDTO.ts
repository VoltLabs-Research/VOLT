export interface CreateScriptingJupyterSessionInputDTO {
    trajectoryId: string;
    notebookId?: string;
}

export interface CreateScriptingJupyterSessionOutputDTO {
    jupyter: {
        url: string;
        ready: boolean;
    };
}
