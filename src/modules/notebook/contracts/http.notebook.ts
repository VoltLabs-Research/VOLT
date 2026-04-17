export interface NotebookSessionSnapshot {
    _id: string;
    teamId: string;
    notebookPath: string;
    content?: Record<string, unknown>;
};

export interface NotebookContainerResources {
    cpus: number;
    memoryMB: number;
};

export interface CreateNotebookSessionRequest {
    requestedBy: string;
    publicBasePath: string;
    notebook: NotebookSessionSnapshot;
    containerResources: NotebookContainerResources;
};

export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface CreateNotebookSessionResponse {
    jupyter: {
        internalPath: string;
        url: string;
        ready: boolean;
        containerStage: NotebookContainerStage;
    };
};
