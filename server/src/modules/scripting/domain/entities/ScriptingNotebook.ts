export interface ScriptingNotebookProps {
    team: string;
    title: string;
    notebookPath: string;
    trajectories: string[];
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
