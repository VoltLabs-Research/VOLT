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

// A notebook's document, as nbformat 4 has it (what Jupyter writes to .ipynb files).
export const NOTEBOOK_MEDIA_TYPE = 'application/x-ipynb+json';

// nbformat's multiline strings: one string, or its lines.
export type NotebookText = string | string[];

// What an output shows, by media type: text (or its lines), or a JSON value.
export type NotebookMimeBundle = Record<string, unknown>;

export type NotebookOutput =
    | { output_type: 'stream'; name: 'stdout' | 'stderr'; text: NotebookText }
    | { output_type: 'display_data'; data: NotebookMimeBundle; metadata: Record<string, unknown> }
    | { output_type: 'execute_result'; execution_count: number | null; data: NotebookMimeBundle; metadata: Record<string, unknown> }
    | { output_type: 'error'; ename: string; evalue: string; traceback: string[] };

export interface NotebookCodeCell{
    id?: string;
    cell_type: 'code';
    source: NotebookText;
    metadata: Record<string, unknown>;
    execution_count: number | null;
    outputs: NotebookOutput[];
}

export interface NotebookTextCell{
    id?: string;
    cell_type: 'markdown' | 'raw';
    source: NotebookText;
    metadata: Record<string, unknown>;
}

export type NotebookCell = NotebookCodeCell | NotebookTextCell;

export interface NotebookDocument{
    cells: NotebookCell[];
    metadata: Record<string, unknown>;
    nbformat: number;
    nbformat_minor: number;
}

export interface ScriptingNotebookWithContent extends ScriptingNotebook{
    content: NotebookDocument;
}

export interface SaveNotebookContentResponse{
    updatedAt: string;
}

// The environment a kernel the client runs for the notebook starts with: its credentials for the
// server, as a Jupyter container on a cluster gets them.
export interface NotebookKernelEnvironment{
    env: Record<string, string>;
}
