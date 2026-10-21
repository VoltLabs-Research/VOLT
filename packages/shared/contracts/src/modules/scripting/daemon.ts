// Payloads of the notebook commands in DaemonCommand.

export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface NotebookSessionSnapshot{
    _id: string;
    teamId: string;
    notebookPath: string;
    content?: Record<string, unknown>;
}

export interface CreateNotebookSessionRequest{
    notebook: NotebookSessionSnapshot;
    requestedBy: string;
    publicBasePath: string;
    baseUrl: string;
    secretKey?: string;
    trajectoryId?: string;
}

export interface CreateNotebookSessionResponse{
    jupyter: {
        internalPath: string;
        url: string;
        ready: boolean;
        containerStage: NotebookContainerStage;
    };
}
