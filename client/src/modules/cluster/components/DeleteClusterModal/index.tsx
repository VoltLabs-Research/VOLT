import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { Box, Modal, closeModal, Stack, Text } from '@voltstack/bravais';
import PasswordConfirmationPrompt from '@/modules/cluster/components/shared/PasswordConfirmationPrompt';
import { useState } from 'react';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/service';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export const DELETE_CLUSTER_MODAL_ID = 'delete-cluster-modal';

interface DeleteClusterModalProps {
    teamCluster: TeamCluster | null;
    onDelete: (password: string) => Promise<DeleteTeamClusterOutputDTO>;
    onClose: () => void;
}

const DeleteClusterModal = ({ teamCluster, onDelete, onClose }: DeleteClusterModalProps) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<DeleteTeamClusterOutputDTO | null>(null);

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
                        onClick: handleClose,
                        disabled: isSubmitting
                    }}
                    primary={result ? undefined : {
                        label: 'Delete cluster',
                        intent: 'danger',
                        onClick: handleSubmit,
                        isLoading: isSubmitting
                    }}
                />
            )}
        >
            <Stack gap='1' p='1-5'>
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
                        <Text as='p' size='md' tone='secondary'>
                            {result.message}
                        </Text>
                        {result.manualUninstallCommand && (
                            <Box p='1' radius='md' overflow='auto' className='bg-page font-family-mono font-size-1'>
                                {result.manualUninstallCommand}
                            </Box>
                        )}
                    </>
                )}
            </Stack>
        </Modal>
    );
};

export default DeleteClusterModal;
