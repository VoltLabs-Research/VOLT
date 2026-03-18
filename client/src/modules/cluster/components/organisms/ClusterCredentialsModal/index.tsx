import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { useEffect, useState } from 'react';
import { sileo } from 'sileo';
import './ClusterCredentialsModal.css';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';

export const CLUSTER_CREDENTIALS_MODAL_ID = 'cluster-credentials-modal';

interface ClusterCredentialsModalProps {
    teamCluster: TeamCluster | null;
    credentials: TeamClusterCredentialServices | null;
    onReveal: (password: string) => Promise<void>;
};

interface ClusterCredentialCard {
    label: string;
    port: number | null;
    username?: string;
    password: string;
};

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

    const handleCopyPassword = async (value: string) => {
        await navigator.clipboard.writeText(value);
        sileo.success({ title: 'Password copied' });
    };

    const services: ClusterCredentialCard[] = credentials
        ? [
            { label: 'MinIO', port: credentials.minio.port, username: credentials.minio.username, password: credentials.minio.password },
            { label: 'Redis', port: credentials.redis.port, username: credentials.redis.username, password: credentials.redis.password },
            { label: 'MongoDB', port: credentials.mongodb.port, username: credentials.mongodb.username, password: credentials.mongodb.password },
            { label: 'Daemon', port: credentials.daemon.port, password: credentials.daemon.password }
        ]
        : [];

    return (
        <Modal
            id={CLUSTER_CREDENTIALS_MODAL_ID}
            title={credentials ? `${teamCluster?.name} Credentials` : 'Reveal Cluster Credentials'}
            description={credentials
                ? 'These credentials are sensitive. Rotate them if they are exposed outside your team.'
                : 'Confirm your password to reveal the encrypted service credentials for this cluster.'}
            footer={(
                <ModalFooterActions
                    secondary={credentials ? undefined : {
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: isSubmitting
                    }}
                    primary={credentials ? {
                        label: 'Done',
                        onClick: handleClose
                    } : {
                        label: 'Reveal credentials',
                        onClick: handleSubmit,
                        isLoading: isSubmitting
                    }}
                />
            )}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                {!credentials && (
                    <>
                        <Paragraph className='font-size-2 color-secondary'>
                            Only reveal credentials when you need to inspect or repair the cluster services directly.
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

                {credentials && (
                    <>
                        <Container className='cluster-credentials-warning d-flex column gap-05 p-1 radius-md' role='status' aria-live='polite'>
                            <Title as='h3' className='font-size-2 font-weight-6 color-primary'>Sensitive credentials</Title>
                            <Paragraph className='font-size-2 color-secondary'>Copy these only into secure tools. Anyone with these values can access cluster services directly.</Paragraph>
                            <label className='d-flex items-start gap-05 cluster-credentials-acknowledgement'>
                                <input
                                    type='checkbox'
                                    checked={hasAcknowledgedSensitiveCopy}
                                    onChange={(event) => setHasAcknowledgedSensitiveCopy(event.target.checked)}
                                />
                                <span className='font-size-2 color-secondary'>I understand these credentials are sensitive and should not be pasted into chat, tickets, or shared docs.</span>
                            </label>
                        </Container>

                        {services.map((service) => (
                            <Container key={service.label} className='cluster-credentials-card d-flex column gap-025 p-1 radius-md'>
                                <Title className='font-size-2 font-weight-6 color-primary'>{service.label}</Title>
                                <Paragraph className='font-size-1 color-secondary'>Port: {service.port ?? 'Not assigned'}</Paragraph>
                                {'username' in service && service.username && (
                                    <Paragraph className='font-size-1 color-secondary'>Username: {service.username}</Paragraph>
                                )}
                                <Container className='d-flex items-center content-between gap-05'>
                                    <Paragraph className='font-family-mono font-size-1 color-primary'>Password: {service.password}</Paragraph>
                                    <Button
                                        variant='ghost'
                                        intent='neutral'
                                        size='sm'
                                        onClick={() => handleCopyPassword(service.password)}
                                        disabled={!hasAcknowledgedSensitiveCopy}
                                    >
                                        Copy
                                    </Button>
                                </Container>
                            </Container>
                        ))}
                    </>
                )}
            </Container>
        </Modal>
    );
};

export default ClusterCredentialsModal;
