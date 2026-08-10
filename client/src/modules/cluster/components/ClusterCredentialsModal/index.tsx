import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import PasswordConfirmationPrompt from '@/modules/cluster/components/shared/PasswordConfirmationPrompt';
import { Button, Modal, closeModal } from '@voltstack/bravais';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { useEffect, useState } from 'react';
import './ClusterCredentialsModal.css';
import type { TeamCluster, TeamClusterCredentialServices } from '@volt/contracts/modules/cluster/domain';

export const CLUSTER_CREDENTIALS_MODAL_ID = 'cluster-credentials-modal';

interface ClusterCredentialsModalProps {
    teamCluster: TeamCluster | null;
    credentials: TeamClusterCredentialServices | null;
    onReveal: (password: string) => Promise<void>;
}

interface ClusterCredentialCard {
    label: string;
    port: number | null;
    username?: string;
    password: string;
}

const ClusterCredentialsModal = ({ teamCluster, credentials, onReveal }: ClusterCredentialsModalProps) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasAcknowledgedSensitiveCopy, setHasAcknowledgedSensitiveCopy] = useState(false);

    useEffect(() => {
        if (credentials) {
            setPassword('');
            setError(undefined);
        }
        setHasAcknowledgedSensitiveCopy(false);
    }, [credentials]);

    const handleClose = () => {
        setPassword('');
        setError(undefined);
        setHasAcknowledgedSensitiveCopy(false);
        closeModal(CLUSTER_CREDENTIALS_MODAL_ID);
    };

    const handleSubmit = async () => {
        if (!password.trim()) {
            setError('Password confirmation is required');
            return;
        }

        setIsSubmitting(true);

        try {
            await onReveal(password);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyPassword = (value: string) => {
        void copyTextToClipboard(value, {
            successMessage: 'Password copied',
            errorMessage: 'Failed to copy password'
        });
    };

    const services: ClusterCredentialCard[] = credentials
        ? [
            {
                label: 'PostgreSQL',
                port: credentials.postgres.port,
                username: credentials.postgres.username,
                password: credentials.postgres.password
            },
            {
                label: 'Daemon',
                port: credentials.daemon.port,
                password: credentials.daemon.password
            }
        ]
        : [];

    return (
        <Modal
            id={CLUSTER_CREDENTIALS_MODAL_ID}
            lazyMount
            title={credentials ? `${teamCluster?.name} Credentials` : 'Reveal Cluster Credentials'}
            description={credentials
                ? 'These credentials are sensitive. Rotate them if they are exposed outside your team.'
                : 'Confirm your password to reveal the encrypted service credentials for this cluster.'}
            footer={(
                <ModalFooterActions
                    secondary={credentials ? undefined : {
                        label: 'Cancel',
                        onPress: handleClose,
                        isDisabled: isSubmitting
                    }}
                    primary={credentials ? {
                        label: 'Done',
                        onPress: handleClose
                    } : {
                        label: 'Reveal credentials',
                        onPress: handleSubmit,
                        isPending: isSubmitting
                    }}
                />
            )}
        >
            <div className='flex flex-col gap-4 p-6'>
                {!credentials && (
                    <PasswordConfirmationPrompt
                        description='Only reveal credentials when you need to inspect or repair the cluster services directly.'
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

                {credentials && (
                    <>
                        <div className='flex flex-col gap-2 p-4 rounded-xl cluster-credentials-warning' role='status' aria-live='polite'>
                            <h3 className='text-sm font-semibold text-foreground'>Sensitive credentials</h3>
                            <p className='text-sm text-muted'>Copy these only into secure tools. Anyone with these values can access cluster services directly.</p>
                            <label className='flex items-start gap-2 cluster-credentials-acknowledgement'>
                                <input
                                    type='checkbox'
                                    checked={hasAcknowledgedSensitiveCopy}
                                    onChange={(event) => setHasAcknowledgedSensitiveCopy(event.target.checked)}
                                />
                                <span className='text-sm text-muted'>I understand these credentials are sensitive and should not be pasted into chat, tickets, or shared docs.</span>
                            </label>
                        </div>

                        {services.map((service) => (
                            <div className='flex flex-col gap-1 p-4 rounded-xl cluster-credentials-card' key={service.label}>
                                <h3 className='text-sm font-semibold text-foreground'>{service.label}</h3>
                                <p className='text-xs text-muted'>Port: {service.port ?? 'Not assigned'}</p>
                                {service.username && (
                                    <p className='text-xs text-muted'>Username: {service.username}</p>
                                )}
                                <div className='flex flex-row items-center justify-between gap-2'>
                                    <p className='text-xs text-foreground font-family-mono'>Password: {service.password}</p>
                                    <Button
                                        variant='ghost'
                                        intent='neutral'
                                        size='sm'
                                        onClick={() => handleCopyPassword(service.password)}
                                        disabled={!hasAcknowledgedSensitiveCopy}
                                    >
                                        Copy
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ClusterCredentialsModal;
