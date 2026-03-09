export interface ScriptingNotebookDTO {
    _id: string;
    teamCluster?: string;
    title: string;
    notebookPath: string;
    trajectories: string[];
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};
