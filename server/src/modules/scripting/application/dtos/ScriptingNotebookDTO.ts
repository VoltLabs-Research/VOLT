import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';

export interface ScriptingNotebookDTO {
    _id: string;
    teamCluster?: ScriptingNotebookProps['teamCluster'];
    title: string;
    notebookPath: string;
    trajectory?: ScriptingNotebookProps['trajectory'];
    trajectories?: ScriptingNotebookProps['trajectories'];
    createdBy?: ScriptingNotebookProps['createdBy'];
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};
