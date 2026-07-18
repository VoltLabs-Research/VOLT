export interface ScriptingNotebookPopulatedUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export interface ScriptingNotebookPopulatedTrajectory {
    _id: string;
    name?: string;
}

export interface ScriptingNotebookPopulatedTeamCluster {
    _id: string;
    name?: string;
}

export interface ScriptingNotebookContainerResourcesDTO {
    cpus: number;
    memoryMB: number;
}

export interface ScriptingNotebookDTO {
    _id: string;
    teamCluster?: string | ScriptingNotebookPopulatedTeamCluster | null;
    containerResources?: ScriptingNotebookContainerResourcesDTO | null;
    title: string;
    notebookPath: string;
    trajectory?: string | ScriptingNotebookPopulatedTrajectory | null;
    createdBy?: string | ScriptingNotebookPopulatedUser;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
