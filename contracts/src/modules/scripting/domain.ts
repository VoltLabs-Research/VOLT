import type { Ref } from '../../shared/base';
import type { User } from '../auth/domain';
import type { TeamCluster } from '../cluster/domain';

export enum ScriptingNotebookScope{
    All = 'all',
    General = 'general',
    Trajectory = 'trajectory'
}

export interface ScriptingNotebookTrajectory{
    _id: string;
    name?: string;
}

export interface ScriptingNotebookContainerResources{
    cpus: number;
    memoryMB: number;
}

export interface ScriptingNotebook{
    _id: string;
    teamCluster?: Ref<TeamCluster> | null;
    containerResources?: ScriptingNotebookContainerResources | null;
    title: string;
    notebookPath: string;
    trajectory?: Ref<ScriptingNotebookTrajectory> | null;
    createdBy?: Ref<User>;
    lastOpenedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface ScriptingSessionJupyter{
    url: string;
    ready: boolean;
    containerStage?: NotebookContainerStage;
}

export interface ScriptingSession{
    notebookId?: string;
    jupyter: ScriptingSessionJupyter;
}

export interface CreateScriptingJupyterSessionResponse{
    notebookId: string;
    jupyter: ScriptingSessionJupyter;
}

export interface GetScriptingSessionStatusResponse{
    notebookId: string;
    jupyter: ScriptingSessionJupyter;
}

export interface DeleteScriptingSessionResponse{
    notebookId: string;
    deleted: boolean;
}
