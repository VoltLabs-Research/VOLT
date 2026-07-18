// Wire response types for the scripting module — the shapes the client reads
// back from `data`. `_id`, refs and dates are strings on the wire. Session
// responses omit the server-only `runtimeNotebookId`/`accessToken` (those are
// applied to the Jupyter-proxy access cookie server-side, never sent in `data`).

/** Notebook listing/scope filter carried as a query param. Runtime enum: the
 * server compares against it and the AI tool validates with `z.nativeEnum`. */
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

/** A scripting notebook as the client sees it (refs may be populated objects). */
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
