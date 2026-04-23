import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { Stack, Row, Text, Heading, Button, Modal, closeModal } from '@/shared/presentation/primitives';
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
            <Stack gap='1' p='1-5'>
                {!credentials && (
                    <>
                        <Text as='p' size='md' tone='secondary'>
                            Only reveal credentials when you need to inspect or repair the cluster services directly.
                        </Text>
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
                        <Stack gap='05' p='1' radius='md' className='cluster-credentials-warning' role='status' aria-live='polite'>
                            <Heading level={3} size='md' weight='bold'>Sensitive credentials</Heading>
                            <Text as='p' size='md' tone='secondary'>Copy these only into secure tools. Anyone with these values can access cluster services directly.</Text>
                            <label className='d-flex items-start gap-05 cluster-credentials-acknowledgement'>
                                <input
                                    type='checkbox'
                                    checked={hasAcknowledgedSensitiveCopy}
                                    onChange={(event) => setHasAcknowledgedSensitiveCopy(event.target.checked)}
                                />
                                <Text size='md' tone='secondary'>I understand these credentials are sensitive and should not be pasted into chat, tickets, or shared docs.</Text>
                            </label>
                        </Stack>

                        {services.map((service) => (
                            <Stack key={service.label} gap='025' p='1' radius='md' className='cluster-credentials-card'>
                                <Heading level={3} size='md' weight='bold'>{service.label}</Heading>
                                <Text as='p' size='sm' tone='secondary'>Port: {service.port ?? 'Not assigned'}</Text>
                                {'username' in service && service.username && (
                                    <Text as='p' size='sm' tone='secondary'>Username: {service.username}</Text>
                                )}
                                <Row justify='between' gap='05'>
                                    <Text as='p' size='sm' tone='primary' className='font-family-mono'>Password: {service.password}</Text>
                                    <Button
                                        variant='ghost'
                                        intent='neutral'
                                        size='sm'
                                        onClick={() => handleCopyPassword(service.password)}
                                        disabled={!hasAcknowledgedSensitiveCopy}
                                    >
                                        Copy
                                    </Button>
                                </Row>
                            </Stack>
                        ))}
                    </>
                )}
            </Stack>
        </Modal>
    );
};

export default ClusterCredentialsModal;
