import {
    scriptingNotebooksQueryKey,
    scriptingNotebooksQuery,
    useUpdateScriptingNotebookMutation
} from './queries';
import useJupyterSession from './use-jupyter-session';
import useNotebookDeploymentPrompt from './use-notebook-deployment-prompt';
import { getNotebookTeamClusterId } from '../utils/notebooks';
import queryClient from '@/shared/query/query-client';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/ui/hooks/toast';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { useCallback, useEffect } from 'react';
import { sileo } from 'sileo';
import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';
import type { ScriptingNotebookDeploymentSelection } from '../components/ScriptingNotebookDeploymentModal';

interface UseScriptingWorkspaceInput {
    trajectoryId: string;
    notebookId?: string;
    onNotebookIdChange?: (notebookId: string) => void;
};

const WORKSPACE_NOTEBOOKS_FETCH_LIMIT = 500;
const SAVE_NOTEBOOK_DEPLOYMENT_TOAST = {
    loading: { title: 'Saving notebook deployment...' },
    success: { title: 'Notebook deployment saved successfully' },
    error: { title: 'Failed to save notebook deployment' }
};

const useScriptingWorkspace = ({ trajectoryId, notebookId, onNotebookIdChange }: UseScriptingWorkspaceInput) => {
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const { mutateAsync: updateNotebook } = useUpdateScriptingNotebookMutation();

    const notebooksQuery = scriptingNotebooksQuery(
        {
            trajectoryId,
            page: 1,
            limit: WORKSPACE_NOTEBOOKS_FETCH_LIMIT
        },
        { enabled: !!trajectoryId }
    );

    useEffect(() => {
        if (!notebooksQuery.error) return;
        if (!checkAccessDeniedError(notebooksQuery.error)) {
            sileo.error({ title: 'Failed to load notebooks' });
        }
    }, [checkAccessDeniedError, notebooksQuery.error]);

    const notebooks = notebooksQuery.data?.data ?? [];
    const activeNotebook = notebooks.find((notebook) => notebook._id === notebookId) ?? notebooks[0];
    const requiresNotebookCreation = !activeNotebook;
    const requiresNotebookConfiguration = Boolean(activeNotebook && !getNotebookTeamClusterId(activeNotebook));

    const handleNotebookCreated = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: scriptingNotebooksQueryKey() });
        await notebooksQuery.refetch();
    }, [notebooksQuery]);

    const {
        jupyterUrl,
        jupyterError,
        containerStage,
        isStartingJupyter,
        startJupyterSession,
        restartSession
    } = useJupyterSession({
        trajectoryId,
        notebookId,
        activeNotebook,
        canAutoStart: !notebooksQuery.isLoading && !requiresNotebookCreation && !requiresNotebookConfiguration,
        checkAccessDeniedError,
        onNotebookIdChange,
        onNotebookCreated: handleNotebookCreated
    });

    const handleConfigureNotebook = useCallback(async (
        notebook: ScriptingNotebook,
        { teamClusterId }: ScriptingNotebookDeploymentSelection
    ) => {
        await showPromise(
            updateNotebook({
                notebookId: notebook._id,
                teamClusterId
            }),
            SAVE_NOTEBOOK_DEPLOYMENT_TOAST
        );
        await notebooksQuery.refetch();
        restartSession();
    }, [notebooksQuery, restartSession, updateNotebook]);

    const {
        deploymentModalRequest,
        deploymentRequiredMessage,
        handleDeploymentModalClose,
        reopenPrompt
    } = useNotebookDeploymentPrompt({
        trajectoryId,
        teamId,
        activeNotebook,
        isNotebooksSettled: !notebooksQuery.isLoading && !(requiresNotebookCreation && notebooksQuery.isFetching),
        requiresNotebookCreation,
        requiresNotebookConfiguration,
        onCreate: startJupyterSession,
        onConfigure: handleConfigureNotebook
    });

    const retryStartJupyter = () => {
        if (!trajectoryId || isStartingJupyter) {
            return;
        }

        if (teamId && (requiresNotebookCreation || requiresNotebookConfiguration)) {
            reopenPrompt();
            return;
        }

        restartSession();
    };

    return {
        isLoading: notebooksQuery.isLoading,
        activeNotebook,
        isStartingJupyter,
        error: jupyterError,
        deploymentRequiredMessage,
        deploymentModalRequest,
        accessDenied,
        accessDeniedMessage,
        jupyterUrl,
        containerStage,
        handleDeploymentModalClose,
        retryStartJupyter
    };
};

export default useScriptingWorkspace;
