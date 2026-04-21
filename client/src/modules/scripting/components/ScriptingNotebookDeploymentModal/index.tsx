import ClusterResourceSelectionPanel from '@/modules/container/components/ClusterResourceSelectionPanel';
import useTeamClusterResourceSelection from '@/modules/container/hooks/use-team-cluster-resource-selection';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import {
    clampScriptingNotebookContainerResources,
    getDefaultScriptingNotebookContainerResources
} from '@/modules/scripting/utilities/deployment';
import { getNotebookContainerResources, getNotebookTeamClusterId } from '@/modules/scripting/utilities/notebooks';
import { useCallback, useEffect, useState } from 'react';
import type { ScriptingNotebook, ScriptingNotebookContainerResources } from '@/modules/scripting/api/entities/scripting-notebook';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

export const SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID = 'scripting-notebook-deployment-modal';

export interface ScriptingNotebookDeploymentSelection {
    teamClusterId: string;
    containerResources: ScriptingNotebookContainerResources;
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
    const [containerResources, setContainerResources] = useState<ScriptingNotebookContainerResources>(
        getDefaultScriptingNotebookContainerResources()
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits
    } = useTeamClusterResourceSelection({
        teamId: request?.teamId,
        selectedTeamClusterId,
        onSelectedTeamClusterIdChange: setSelectedTeamClusterId
    });

    useEffect(() => {
        if (!request) {
            return;
        }

        setSelectedTeamClusterId(getNotebookTeamClusterId(request.notebook) ?? null);
        setContainerResources(
            getNotebookContainerResources(request.notebook) ?? getDefaultScriptingNotebookContainerResources()
        );
        setIsSubmitting(false);
    }, [request]);

    useEffect(() => {
        setContainerResources((currentResources) => {
            return clampScriptingNotebookContainerResources(currentResources, clusterResourceLimits);
        });
    }, [clusterResourceLimits?.maxCpus, clusterResourceLimits?.maxMemoryMB]);

    const handleClose = useCallback(() => {
        if (isSubmitting) {
            return;
        }

        closeModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
        onClose();
    }, [isSubmitting, onClose]);

    const handleSubmit = useCallback(async () => {
        if (!request || !selectedTeamClusterId || !clusterResourceLimits?.maxCpus || !clusterResourceLimits?.maxMemoryMB) {
            return;
        }

        setIsSubmitting(true);
        try {
            await request.onSubmit({
                teamClusterId: selectedTeamClusterId,
                containerResources
            });
            closeModal(SCRIPTING_NOTEBOOK_DEPLOYMENT_MODAL_ID);
            onClose({ completed: true });
        } finally {
            setIsSubmitting(false);
        }
    }, [clusterResourceLimits?.maxCpus, clusterResourceLimits?.maxMemoryMB, containerResources, onClose, request, selectedTeamClusterId]);

    const primaryAction: ModalFooterAction = {
        label: isSubmitting ? 'Saving...' : request?.confirmLabel ?? 'Save',
        onClick: handleSubmit,
        disabled: isSubmitting || !selectedTeamClusterId || !clusterResourceLimits?.maxCpus || !clusterResourceLimits?.maxMemoryMB
    };

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleClose,
        disabled: isSubmitting
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
            <div className='p-1-5 d-flex column gap-1'>
                {request?.notebook && (
                    <p className='volt-text font-size-2 color-secondary'>
                        Notebook: {request.notebook.title || 'Untitled Notebook'}
                    </p>
                )}
                <ClusterResourceSelectionPanel
                    teamClusters={teamClusters}
                    isTeamSelected={Boolean(request?.teamId)}
                    selectedTeamClusterId={selectedTeamClusterId}
                    clusterResourceLimits={clusterResourceLimits}
                    isLoadingResourceLimits={isLoadingResourceLimits}
                    cpus={containerResources.cpus}
                    memoryMB={containerResources.memoryMB}
                    onTeamClusterChange={setSelectedTeamClusterId}
                    onCpusChange={(cpus) => setContainerResources((current) => ({ ...current, cpus }))}
                    onMemoryChange={(memoryMB) => setContainerResources((current) => ({ ...current, memoryMB }))}
                />
            </div>
        </Modal>
    );
};

export default ScriptingNotebookDeploymentModal;
