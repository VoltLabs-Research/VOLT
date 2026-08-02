import { SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID } from '../components/ScriptingNotebookDeploymentModal';
import { closeModal, openModal } from '@voltstack/bravais';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';
import type {
    ScriptingNotebookDeploymentModalRequest,
    ScriptingNotebookDeploymentSelection
} from '../components/ScriptingNotebookDeploymentModal';

interface UseNotebookDeploymentPromptInput {
    trajectoryId: string;
    teamId?: string | null;
    activeNotebook?: ScriptingNotebook;
    isNotebooksSettled: boolean;
    requiresNotebookCreation: boolean;
    requiresNotebookConfiguration: boolean;
    onCreate: (selection: ScriptingNotebookDeploymentSelection) => Promise<void>;
    onConfigure: (notebook: ScriptingNotebook, selection: ScriptingNotebookDeploymentSelection) => Promise<void>;
};

/**
 * Asks the user for a cluster before Jupyter can start, at most once per notebook, and
 * keeps a message on screen while that choice is still outstanding.
 */
const useNotebookDeploymentPrompt = ({
    trajectoryId,
    teamId,
    activeNotebook,
    isNotebooksSettled,
    requiresNotebookCreation,
    requiresNotebookConfiguration,
    onCreate,
    onConfigure
}: UseNotebookDeploymentPromptInput) => {
    const [deploymentModalRequest, setDeploymentModalRequest] = useState<ScriptingNotebookDeploymentModalRequest | null>(null);
    const [deploymentRequiredMessage, setDeploymentRequiredMessage] = useState<string | null>(null);
    const lastPromptKeyRef = useRef<string | null>(null);

    const handleDeploymentModalClose = useCallback((options?: { completed?: boolean }) => {
        closeModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
        setDeploymentModalRequest(null);
        setDeploymentRequiredMessage(options?.completed
            ? null
            : activeNotebook
                ? 'Configure this notebook deployment before starting Jupyter.'
                : 'Choose a cluster to create the notebook workspace.'
        );
    }, [activeNotebook]);

    /** Lets the next render re-open the prompt the user dismissed. */
    const reopenPrompt = useCallback(() => {
        lastPromptKeyRef.current = null;
        setDeploymentRequiredMessage(null);
    }, []);

    useEffect(() => {
        if (!trajectoryId || !teamId || !isNotebooksSettled) {
            return;
        }

        const promptKey = requiresNotebookCreation
            ? `create:${trajectoryId}`
            : requiresNotebookConfiguration && activeNotebook
                ? `configure:${activeNotebook._id}`
                : null;

        if (!promptKey || deploymentModalRequest || lastPromptKeyRef.current === promptKey) {
            return;
        }

        lastPromptKeyRef.current = promptKey;
        setDeploymentRequiredMessage(null);
        setDeploymentModalRequest(activeNotebook && requiresNotebookConfiguration
            ? {
                teamId,
                notebook: activeNotebook,
                title: 'Configure Notebook Deployment',
                description: 'Select the cluster this notebook should use before starting Jupyter.',
                confirmLabel: 'Save and start',
                onSubmit: (selection) => onConfigure(activeNotebook, selection)
            }
            : {
                teamId,
                title: 'Create Notebook Workspace',
                description: 'Choose the cluster for the notebook container before starting Jupyter.',
                confirmLabel: 'Start notebook',
                onSubmit: onCreate
            }
        );
        openModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
    }, [
        activeNotebook,
        deploymentModalRequest,
        isNotebooksSettled,
        onConfigure,
        onCreate,
        requiresNotebookConfiguration,
        requiresNotebookCreation,
        teamId,
        trajectoryId
    ]);

    return {
        deploymentModalRequest,
        deploymentRequiredMessage,
        handleDeploymentModalClose,
        reopenPrompt
    };
};

export default useNotebookDeploymentPrompt;
