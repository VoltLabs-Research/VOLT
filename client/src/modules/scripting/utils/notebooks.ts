import type {
    ScriptingNotebook,
    ScriptingNotebookTrajectory
} from '@volt/contracts/modules/scripting/domain';
import { createListingDeleteConfirmation } from '@/shared/ui/utils/listing-messages';

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

export const getNotebookTeamClusterId = (notebook?: ScriptingNotebook | null): string | undefined => {
    if (!notebook?.teamCluster) {
        return undefined;
    }

    if (typeof notebook.teamCluster === 'string') {
        return notebook.teamCluster;
    }

    return notebook.teamCluster._id;
};

export const hasNotebookDeploymentConfiguration = (notebook?: ScriptingNotebook | null): boolean => {
    return Boolean(getNotebookTeamClusterId(notebook));
};

export const getDeleteConfirmationMessage = createListingDeleteConfirmation<ScriptingNotebook>({
    singularName: 'notebook',
    pluralName: 'notebooks',
    untitledLabel: 'Untitled Notebook'
});
