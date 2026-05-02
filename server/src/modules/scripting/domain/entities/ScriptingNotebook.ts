export interface ScriptingNotebookContainerResources {
    cpus: number;
    memoryMB: number;
}

export interface ScriptingNotebookProps {
    team: string;
    teamCluster?: string;
    containerResources?: ScriptingNotebookContainerResources;
    runtimeNotebookId?: string;
    title: string;
    notebookPath: string;
    trajectory?: string | null;
    createdBy: string;
    content: Record<string, unknown>;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ScriptingNotebook {
    readonly _id: string;
    props: ScriptingNotebookProps;
}

export const createScriptingNotebook = (_id: string, props: ScriptingNotebookProps): ScriptingNotebook => ({
    _id,
    props
});

export default ScriptingNotebook;
