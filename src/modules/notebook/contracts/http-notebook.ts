export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface NotebookContainerResources {
    cpus: number;
    memoryMB: number;
}

export interface NotebookSessionSnapshot {
    _id: string;
    teamId: string;
    notebookPath: string;
    content: Record<string, unknown>;
}

export interface CreateNotebookSessionRequest {
    notebook: NotebookSessionSnapshot;
    requestedBy: string;
    publicBasePath: string;
}

export interface CreateNotebookSessionResponse {
    jupyter: {
        internalPath: string;
        url: string;
        ready: boolean;
        containerStage: NotebookContainerStage;
    };
}
