import { getTeamClusterRemoteAccessDescription, getTeamClusterRemoteAccessLabel } from '@/modules/cluster/utilities/team-cluster-remote-access';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { useState } from 'react';
import type { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export const CLUSTER_REMOTE_ACCESS_PASSWORD_MODAL_ID = 'cluster-remote-access-password-modal';

interface ClusterRemoteAccessPasswordModalProps {
    teamCluster: TeamCluster | null;
    target: TeamClusterRemoteAccessTarget | null;
    onSubmit: (password: string) => Promise<void>;
    onClose: () => void;
};

const ClusterRemoteAccessPasswordModal = ({
    teamCluster,
    target,
    onSubmit,
    onClose
}: ClusterRemoteAccessPasswordModalProps) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = () => {
        setPassword('');
        setError(undefined);
        closeModal(CLUSTER_REMOTE_ACCESS_PASSWORD_MODAL_ID);
        onClose();
    };

    const handleSubmit = async () => {
        if (!password.trim()) {
            setError('Password confirmation is required');
            return;
        }

        setIsSubmitting(true);

        try {
            await onSubmit(password);
            handleClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const actionLabel = target
        ? getTeamClusterRemoteAccessLabel(target)
        : 'Remote access';
    const actionDescription = target
        ? getTeamClusterRemoteAccessDescription(target)
        : 'Confirm your password to continue.';

    return (
        <Modal
            id={CLUSTER_REMOTE_ACCESS_PASSWORD_MODAL_ID}
            title={`${actionLabel}${teamCluster ? ` · ${teamCluster.name}` : ''}`}
            description={actionDescription}
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: isSubmitting
                    }}
                    primary={{
                        label: actionLabel,
                        onClick: handleSubmit,
                        isLoading: isSubmitting
                    }}
                />
            )}
            onClose={onClose}
        >
            <Container className='d-flex column gap-1'>
                <Paragraph className='font-size-2 color-secondary'>
                    Remote access is sensitive. Confirm your password before opening this cluster resource.
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
            </Container>
        </Modal>
    );
};

export default ClusterRemoteAccessPasswordModal;
