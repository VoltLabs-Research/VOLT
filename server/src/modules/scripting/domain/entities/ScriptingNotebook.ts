export interface PopulatedScriptingNotebookUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
};

export interface PopulatedScriptingNotebookTrajectory {
    _id: string;
    name?: string;
};

export interface PopulatedScriptingNotebookTeamCluster {
    _id: string;
    name?: string;
};

export interface ScriptingNotebookProps {
    team: string;
    teamCluster?: string | PopulatedScriptingNotebookTeamCluster | null;
    runtimeNotebookId?: string;
    title: string;
    notebookPath: string;
    trajectory?: string | PopulatedScriptingNotebookTrajectory | null;
    trajectories?: Array<string | PopulatedScriptingNotebookTrajectory>;
    createdBy: string | PopulatedScriptingNotebookUser;
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
