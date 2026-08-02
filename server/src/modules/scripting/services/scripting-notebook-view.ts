import type ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import type { ScriptingNotebookView } from '@modules/scripting/contracts/scripting-notebook';

const resolveRef = (id: string | null | undefined, relation: object | null | undefined): unknown => {
    if(id === undefined || id === null){
        return null;
    }

    return relation ?? id;
};

export const toScriptingNotebookView = (notebook: ScriptingNotebook): ScriptingNotebookView => ({
    _id: notebook.id,
    teamCluster: resolveRef(notebook.teamCluster, notebook.teamClusterRef),
    containerResources: notebook.containerResources,
    title: notebook.title,
    notebookPath: notebook.notebookPath,
    trajectory: resolveRef(notebook.trajectory, notebook.trajectoryRef),
    createdBy: resolveRef(notebook.createdBy, notebook.createdByRef),
    lastOpenedAt: notebook.lastOpenedAt ?? undefined,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt
});
