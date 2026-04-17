export interface NotebookSessionContentObject {
    [key: string]: NotebookSessionContent;
}

export type NotebookSessionContent =
    | boolean
    | NotebookSessionContentObject
    | NotebookSessionContent[]
    | null
    | number
    | string

export interface NotebookContainerResources {
    cpus: number;
    memoryMB: number;
}

export interface NotebookSessionSnapshot {
    _id: string;
    teamId: string;
    notebookPath: string;
    content?: NotebookSessionContentObject;
}

export interface CreateNotebookSessionRequest {
    requestedBy: string;
    publicBasePath: string;
    notebook: NotebookSessionSnapshot;
    containerResources: NotebookContainerResources;
}

export type NotebookContainerStage = 'creating' | 'starting' | 'ready'

export interface NotebookRuntimeDescriptor {
    internalPath: string;
    url: string;
    ready: boolean;
    containerStage: NotebookContainerStage;
}

export interface CreateNotebookSessionResponse {
    jupyter: NotebookRuntimeDescriptor;
}
