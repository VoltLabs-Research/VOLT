import { getTeamClusterRemoteAccessDescription, getTeamClusterRemoteAccessLabel } from '@/modules/cluster/utilities/team-cluster-remote-access';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import { useState } from 'react';
import type { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';

export const CLUSTER_REMOTE_ACCESS_MODAL_ID = 'cluster-remote-access-modal';

interface ClusterRemoteAccessModalProps {
    target: TeamClusterRemoteAccessTarget;
    clusterName: string;
    isLoading: boolean;
    error: string | null;
    onSubmit: (password: string) => Promise<void>;
    onDismiss: () => void;
};

const ClusterRemoteAccessModal = ({
    target,
    clusterName,
    isLoading,
    error,
    onSubmit,
    onDismiss
}: ClusterRemoteAccessModalProps) => {
    const [password, setPassword] = useState('');
    const [validationError, setValidationError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const actionLabel = getTeamClusterRemoteAccessLabel(target);
    const actionDescription = getTeamClusterRemoteAccessDescription(target);
    const displayError = validationError || error || undefined;

    const handleSubmit = async () => {
        if (!password.trim()) {
            setValidationError('Password confirmation is required');
            return;
        }

        setValidationError(undefined);
        setIsSubmitting(true);

        try {
            await onSubmit(password);
            closeModal(CLUSTER_REMOTE_ACCESS_MODAL_ID);
        } catch {
            // Error is handled by the parent hook via `error` prop;
            // modal stays open so the user can retry.
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    };

    const footer = (
        <ModalFooterActions
            secondary={{
                label: 'Cancel',
                onClick: onDismiss,
                disabled: isSubmitting
            }}
            primary={{
                label: actionLabel,
                onClick: handleSubmit,
                isLoading: isSubmitting || isLoading
            }}
        />
    );

    return (
        <Modal
            id={CLUSTER_REMOTE_ACCESS_MODAL_ID}
            title={`${actionLabel} · ${clusterName}`}
            description={actionDescription}
            footer={footer}
            onClose={onDismiss}
        >
            <div className='volt-container d-flex column gap-1 p-1-5'>
                <p className='volt-text font-size-2 color-secondary'>
                    Remote access is sensitive. Confirm your password before opening this cluster resource.
                </p>
                <FormFieldRHF
                    label='Password'
                    type='password'
                    value={password}
                    error={displayError}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        if (validationError) {
                            setValidationError(undefined);
                        }
                    }}
                    inputProps={{ onKeyDown: handleKeyDown }}
                />
            </div>
        </Modal>
    );
};

export default ClusterRemoteAccessModal;
