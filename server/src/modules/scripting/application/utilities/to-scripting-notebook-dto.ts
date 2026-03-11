import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookDTO } from '@modules/scripting/application/dtos/ScriptingNotebookDTO';

export const toScriptingNotebookDTO = (notebook: ScriptingNotebook): ScriptingNotebookDTO => {
    let trajectories: string[] = [];

    if (Array.isArray(notebook.props.trajectories)) {
        trajectories = notebook.props.trajectories.map(String);
    }

    return {
        _id: notebook._id,
        teamCluster: notebook.props.teamCluster,
        title: notebook.props.title,
        notebookPath: notebook.props.notebookPath,
        trajectories,
        lastOpenedAt: notebook.props.lastOpenedAt,
        createdAt: notebook.props.createdAt,
        updatedAt: notebook.props.updatedAt
    };
};
