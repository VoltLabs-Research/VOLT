import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Modal, closeModal } from '@/shared/ui/modal';
import PasswordConfirmationPrompt from '@/modules/cluster/components/shared/PasswordConfirmationPrompt';
import { useState } from 'react';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import type { DeleteTeamClusterResponse } from '@volt/contracts/modules/cluster/domain';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';

export const DELETE_CLUSTER_MODAL_ID = 'delete-cluster-modal';

interface DeleteClusterModalProps {
    teamCluster: TeamCluster | null;
    onDelete: (password: string) => Promise<DeleteTeamClusterResponse>;
    onClose: () => void;
}

const DeleteClusterModal = ({ teamCluster, onDelete, onClose }: DeleteClusterModalProps) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<DeleteTeamClusterResponse | null>(null);

    const isConnectedCluster = teamCluster?.status === TeamClusterStatus.Connected;

    const handleClose = () => {
        setPassword('');
        setError(undefined);
        setResult(null);
        closeModal(DELETE_CLUSTER_MODAL_ID);
        onClose();
    };

    const handleSubmit = async () => {
        if (!password.trim()) {
            setError('Password confirmation is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const nextResult = await onDelete(password);
            if (nextResult.manualUninstallRequired) {
                setResult(nextResult);
                setPassword('');
                return;
            }

            handleClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const modalDescription = isConnectedCluster
        ? 'Deleting a connected cluster requests uninstall through the daemon first. Volt keeps the cluster in deleting state until cleanup is confirmed or the runtime stops heartbeating.'
        : 'Deleting an offline cluster removes its control-plane record immediately. Remote uninstall cannot be guaranteed, so Volt may show a manual cleanup command.';

    return (
        <Modal
            id={DELETE_CLUSTER_MODAL_ID}
            lazyMount
            title={`Delete ${teamCluster?.name ?? 'cluster'}`}
            description={modalDescription}
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: result ? 'Done' : 'Cancel',
                        onPress: handleClose,
                        isDisabled: isSubmitting
                    }}
                    primary={result ? undefined : {
                        label: 'Delete cluster',
                        variant: 'danger',
                        onPress: handleSubmit,
                        isPending: isSubmitting
                    }}
                />
            )}
        >
            <div className='flex flex-col gap-4 p-6'>
                {!result && (
                    <PasswordConfirmationPrompt
                        description='Confirm your password to continue with the uninstall and delete flow.'
                        password={password}
                        error={error}
                        onPasswordChange={(nextPassword) => {
                            setPassword(nextPassword);
                            if (error) {
                                setError(undefined);
                            }
                        }}
                    />
                )}
                {result?.manualUninstallRequired && (
                    <>
                        <p className='text-sm text-muted'>
                            {result.message}
                        </p>
                        {result.manualUninstallCommand && (
                            <div className='p-4 rounded-xl overflow-auto bg-background font-mono text-xs'>
                                {result.manualUninstallCommand}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default DeleteClusterModal;
