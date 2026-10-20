import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';
import { createListingDeleteConfirmation } from '@/shared/ui/utils/listing-messages';

export const getNotebookTrajectoryId = (notebook: ScriptingNotebook): string | undefined => {
    const trajectory = notebook.trajectory;
    if (!trajectory) {
        return undefined;
    }

    return typeof trajectory === 'string' ? trajectory : trajectory._id;
};

export const getNotebookTeamClusterId = (notebook?: ScriptingNotebook | null): string | undefined => {
    const teamCluster = notebook?.teamCluster;
    if (!teamCluster) {
        return undefined;
    }

    return typeof teamCluster === 'string' ? teamCluster : teamCluster._id;
};

export const getDeleteConfirmationMessage = createListingDeleteConfirmation<ScriptingNotebook>({
    singularName: 'notebook',
    pluralName: 'notebooks',
    untitledLabel: 'Untitled Notebook'
});
