import type { ScriptingNotebookContainerResources } from '@volt/contracts/modules/scripting/domain';

export interface ScriptingNotebookContent{
    [key: string]: unknown;
}

export interface ScriptingNotebookView{
    _id: string;
    teamCluster?: unknown;
    containerResources?: ScriptingNotebookContainerResources | null;
    title: string;
    notebookPath: string;
    trajectory?: unknown;
    createdBy?: unknown;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotebookIdentityInput{
    teamId: string;
    notebookId: string;
}
