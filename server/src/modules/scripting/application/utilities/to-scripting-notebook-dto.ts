import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookDTO } from '@modules/scripting/application/dtos/ScriptingNotebookDTO';

export const toScriptingNotebookDTO = (notebook: ScriptingNotebook): ScriptingNotebookDTO => {
    return {
        _id: notebook._id,
        teamCluster: notebook.props.teamCluster ?? null,
        containerResources: notebook.props.containerResources
            ? {
                cpus: notebook.props.containerResources.cpus,
                memoryMB: notebook.props.containerResources.memoryMB
            }
            : null,
        title: notebook.props.title,
        notebookPath: notebook.props.notebookPath,
        trajectory: notebook.props.trajectory ?? null,
        createdBy: notebook.props.createdBy,
        lastOpenedAt: notebook.props.lastOpenedAt,
        createdAt: notebook.props.createdAt,
        updatedAt: notebook.props.updatedAt
    };
};
