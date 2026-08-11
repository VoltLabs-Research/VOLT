import ClusterResourceSelectionPanel from '@/modules/container/components/ClusterResourceSelectionPanel';
import useTeamClusterResourceSelection from '@/modules/container/hooks/use-team-cluster-resource-selection';
import { Modal, closeModal } from '@/shared/ui/modal';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { getNotebookTeamClusterId } from '@/modules/scripting/utils/notebooks';
import { useCallback, useEffect, useState } from 'react';
import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';
import type { ModalFooterAction } from '@/shared/ui/components/ModalFooterActions';

export const SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID = 'scripting-notebook-deployment-modal';

export interface ScriptingNotebookDeploymentSelection {
    teamClusterId: string;
};

export interface ScriptingNotebookDeploymentModalRequest {
    teamId: string;
    title: string;
    description: string;
    confirmLabel: string;
    notebook?: ScriptingNotebook | null;
    onSubmit: (selection: ScriptingNotebookDeploymentSelection) => Promise<void>;
};

interface ScriptingNotebookDeploymentModalProps {
    request: ScriptingNotebookDeploymentModalRequest | null;
    onClose: (options?: { completed?: boolean }) => void;
};

const ScriptingNotebookDeploymentModal = ({
    request,
    onClose
}: ScriptingNotebookDeploymentModalProps) => {
    const [selectedTeamClusterId, setSelectedTeamClusterId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {
        teamClusters
    } = useTeamClusterResourceSelection({
        teamId: request?.teamId,
        selectedTeamClusterId,
        onSelectedTeamClusterIdChange: setSelectedTeamClusterId,
        includeResourceLimits: false
    });

    useEffect(() => {
        if (!request) {
            return;
        }

        setSelectedTeamClusterId(getNotebookTeamClusterId(request.notebook) ?? null);
        setIsSubmitting(false);
    }, [request]);

    const handleClose = useCallback(() => {
        if (isSubmitting) {
            return;
        }

        closeModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
        onClose();
    }, [isSubmitting, onClose]);

    const handleSubmit = useCallback(async () => {
        if (!request || !selectedTeamClusterId) {
            return;
        }

        setIsSubmitting(true);
        try {
            await request.onSubmit({
                teamClusterId: selectedTeamClusterId
            });
            closeModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
            onClose({ completed: true });
        } finally {
            setIsSubmitting(false);
        }
    }, [onClose, request, selectedTeamClusterId]);

    const primaryAction: ModalFooterAction = {
        label: isSubmitting ? 'Saving...' : request?.confirmLabel ?? 'Save',
        onPress: handleSubmit,
        isDisabled: isSubmitting || !selectedTeamClusterId
    };

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onPress: handleClose,
        isDisabled: isSubmitting
    };

    return (
        <Modal
            id={SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID}
            title={request?.title}
            description={request?.description}
            onClose={handleClose}
            dismissible={!isSubmitting}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
            width='720px'
        >
            <div className='flex flex-col gap-4'>
                {request?.notebook && (
                    <p className='text-sm text-muted'>
                        Notebook: {request.notebook.title || 'Untitled Notebook'}
                    </p>
                )}
                <ClusterResourceSelectionPanel
                    teamClusters={teamClusters}
                    isTeamSelected={Boolean(request?.teamId)}
                    selectedTeamClusterId={selectedTeamClusterId}
                    onTeamClusterChange={setSelectedTeamClusterId}
                    showResourceSelection={false}
                />
            </div>
        </Modal>
    );
};

export default ScriptingNotebookDeploymentModal;
