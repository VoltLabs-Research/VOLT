

export enum ScriptingNotebookScope{
    All = 'all',
    General = 'general',
    Trajectory = 'trajectory'
}

export interface ScriptingNotebookPopulatedUser{
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export interface ScriptingNotebookPopulatedTrajectory{
    _id: string;
    name?: string;
}

export interface ScriptingNotebookPopulatedTeamCluster{
    _id: string;
    name?: string;
}

export interface ScriptingNotebookContainerResources{
    cpus: number;
    memoryMB: number;
}

export interface PersistedScriptingNotebook{
    _id: string;
    teamCluster?: string | ScriptingNotebookPopulatedTeamCluster | null;
    containerResources?: ScriptingNotebookContainerResources | null;
    title: string;
    notebookPath: string;
    trajectory?: string | ScriptingNotebookPopulatedTrajectory | null;
    createdBy?: string | ScriptingNotebookPopulatedUser;
    lastOpenedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface ScriptingSessionJupyterInfo{
    url: string;
    ready: boolean;
    containerStage?: NotebookContainerStage;
}

export interface CreateScriptingJupyterSessionResponse{
    notebookId: string;
    jupyter: ScriptingSessionJupyterInfo;
}

export interface GetScriptingSessionStatusResponse{
    notebookId: string;
    jupyter: {
        ready: boolean;
        url: string;
        containerStage?: NotebookContainerStage;
    };
}

export interface DeleteScriptingSessionResponse{
    notebookId: string;
    deleted: boolean;
}
