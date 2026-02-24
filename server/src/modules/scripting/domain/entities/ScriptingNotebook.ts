export interface ScriptingNotebookProps {
    team: string;
    title: string;
    notebookPath: string;
    trajectories: string[];
    createdBy: any;
    content: Record<string, unknown>;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export default class ScriptingNotebook {
    constructor(
        public id: string,
        public props: ScriptingNotebookProps
    ) {}
}
