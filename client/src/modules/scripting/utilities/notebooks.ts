import type {
    ScriptingNotebook,
    ScriptingNotebookContainerResources,
    ScriptingNotebookTrajectory
} from '@/modules/scripting/api/entities/scripting-notebook';

const getTrajectoryId = (trajectory: ScriptingNotebookTrajectory | string): string => {
    if (typeof trajectory === 'string') {
        return trajectory;
    }

    return trajectory._id;
};

export const getPrimaryTrajectory = (notebook: ScriptingNotebook): ScriptingNotebookTrajectory | string | null => {
    return notebook.trajectory ?? null;
};

export const getTrajectoryIds = (notebook: ScriptingNotebook): string[] => {
    const primaryTrajectory = getPrimaryTrajectory(notebook);
    if (!primaryTrajectory) {
        return [];
    }

    return [getTrajectoryId(primaryTrajectory)].filter((id) => id.trim().length > 0);
};

/** Returns the notebook team cluster id from either a populated relation or a raw id. */
export const getNotebookTeamClusterId = (notebook?: ScriptingNotebook | null): string | undefined => {
    if (!notebook?.teamCluster) {
        return undefined;
    }

    if (typeof notebook.teamCluster === 'string') {
        return notebook.teamCluster;
    }

    return notebook.teamCluster._id;
};

export const getNotebookContainerResources = (
    notebook?: ScriptingNotebook | null
): ScriptingNotebookContainerResources | null => {
    return notebook?.containerResources ?? null;
};

export const hasNotebookDeploymentConfiguration = (notebook?: ScriptingNotebook | null): boolean => {
    return Boolean(getNotebookTeamClusterId(notebook) && getNotebookContainerResources(notebook));
};

export const getDeleteConfirmationMessage = (selectedItems: ScriptingNotebook[]): string => {
    if (selectedItems.length === 1) {
        return `Delete notebook "${selectedItems[0].title || 'Untitled Notebook'}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} notebooks? This action cannot be undone.`;
};
