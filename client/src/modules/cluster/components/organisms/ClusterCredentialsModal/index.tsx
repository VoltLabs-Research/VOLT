import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
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

    useEffect(() => {
        if (credentials) {
            setPassword('');
            setError(undefined);
        }
    }, [credentials]);

    const handleClose = () => {
        setPassword('');
        setError(undefined);
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
            footer={credentials ? (
                <Button variant='solid' intent='brand' onClick={handleClose}>
                    Done
                </Button>
            ) : (
                <>
                    <Button variant='ghost' intent='neutral' onClick={handleClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button variant='solid' intent='brand' onClick={handleSubmit} isLoading={isSubmitting}>
                        Reveal credentials
                    </Button>
                </>
            )}
        >
            <Container className='d-flex column gap-1'>
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

                {credentials && services.map((service) => (
                    <Container key={service.label} className='cluster-credentials-card d-flex column gap-025 p-1 radius-md'>
                        <Title className='font-size-2 font-weight-6 color-primary'>{service.label}</Title>
                        <Paragraph className='font-size-1 color-secondary'>Port: {service.port ?? 'Not assigned'}</Paragraph>
                        {'username' in service && service.username && (
                            <Paragraph className='font-size-1 color-secondary'>Username: {service.username}</Paragraph>
                        )}
                        <Container className='d-flex items-center content-between gap-05'>
                            <Paragraph className='font-family-mono font-size-1 color-primary'>Password: {service.password}</Paragraph>
                            <Button variant='ghost' intent='neutral' size='sm' onClick={() => handleCopyPassword(service.password)}>
                                Copy
                            </Button>
                        </Container>
                    </Container>
                ))}
            </Container>
        </Modal>
    );
};

export default ClusterCredentialsModal;
