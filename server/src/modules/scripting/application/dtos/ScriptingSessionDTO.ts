export interface ScriptingSessionIdentityDTO {
    teamId: string;
    notebookId: string;
};

export interface GetScriptingSessionStatusInputDTO extends ScriptingSessionIdentityDTO {
    userId?: string;
};

export interface GetScriptingSessionStatusOutputDTO {
    notebookId: string;
    runtimeNotebookId?: string;
    accessToken?: string;
    jupyter: {
        ready: boolean;
        url: string;
        containerStage?: 'creating' | 'starting' | 'ready';
    };
};

export type DeleteScriptingSessionInputDTO = ScriptingSessionIdentityDTO;

export interface DeleteScriptingSessionOutputDTO {
    notebookId: string;
    deleted: boolean;
    runtimeNotebookId?: string;
};
