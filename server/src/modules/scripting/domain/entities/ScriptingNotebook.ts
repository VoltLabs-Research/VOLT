export interface ScriptingNotebookContainerResources {
    cpus: number;
    memoryMB: number;
};

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
};

export default class ScriptingNotebook {
    constructor(
        public readonly _id: string,
        public props: ScriptingNotebookProps
    ) {}

    get id(): string {
        return this._id;
    }
};
