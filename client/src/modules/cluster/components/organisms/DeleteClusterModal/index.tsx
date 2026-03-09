import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { useState } from 'react';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export const DELETE_CLUSTER_MODAL_ID = 'delete-cluster-modal';

interface DeleteClusterModalProps {
    teamCluster: TeamCluster | null;
    onDelete: (password: string) => Promise<DeleteTeamClusterOutputDTO>;
    onClose: () => void;
};

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
            <Container className='d-flex column gap-1'>
                {!result && (
                    <>
                        <Paragraph className='font-size-2 color-secondary'>
                            Confirm your password to continue with the uninstall and delete flow.
                        </Paragraph>
                        <FormFieldRHF
                            label='Password'
                            type='password'
                            value={password}
                            error={error}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                if (error) {
                                    setError(undefined);
                                }
                            }}
                        />
                    </>
                )}
                {result?.manualUninstallRequired && (
                    <>
                        <Paragraph className='font-size-2 color-secondary'>
                            {result.message}
                        </Paragraph>
                        {result.manualUninstallCommand && (
                            <Container className='p-1 radius-md bg-page font-family-mono font-size-1 overflow-auto'>
                                {result.manualUninstallCommand}
                            </Container>
                        )}
                    </>
                )}
            </Container>
        </Modal>
    );
};

export default DeleteClusterModal;
