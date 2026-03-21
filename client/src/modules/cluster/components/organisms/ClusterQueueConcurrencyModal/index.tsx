import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { useEffect, useMemo, useState } from 'react';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type {
    TeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-queue-concurrency';

interface QueueFieldDefinition {
    key: keyof TeamClusterQueueConcurrencyInputDTO;
    label: string;
    description: string;
};

interface ClusterQueueConcurrencyModalProps {
    teamCluster: TeamCluster | null;
    onSave: (queueConcurrency: TeamClusterQueueConcurrencyInputDTO) => Promise<UpdateTeamClusterQueueConcurrencyOutputDTO>;
    onClose: () => void;
};

const MIN_CONCURRENCY = 1;

const QUEUE_FIELDS: QueueFieldDefinition[] = [
    {
        key: 'analysis',
        label: 'Analysis',
        description: 'Workflow analysis jobs'
    },
    {
        key: 'rasterizer',
        label: 'Rasterizer',
        description: 'Trajectory preview generation'
    },
    {
        key: 'glbPreprocessing',
        label: 'GLB preprocessing',
        description: 'Trajectory model preprocessing'
    },
    {
        key: 'sshImport',
        label: 'SSH import',
        description: 'Remote trajectory imports'
    }
];

export const CLUSTER_QUEUE_CONCURRENCY_MODAL_ID = 'cluster-queue-concurrency-modal';

const createInitialValues = (teamCluster: TeamCluster | null): Record<keyof TeamClusterQueueConcurrencyInputDTO, string> => {
    return {
        analysis: String(teamCluster?.queueConcurrency.analysis ?? ''),
        rasterizer: String(teamCluster?.queueConcurrency.rasterizer ?? ''),
        glbPreprocessing: String(teamCluster?.queueConcurrency.glbPreprocessing ?? ''),
        sshImport: String(teamCluster?.queueConcurrency.sshImport ?? '')
    };
};

const ClusterQueueConcurrencyModal = ({ teamCluster, onSave, onClose }: ClusterQueueConcurrencyModalProps) => {
    const [values, setValues] = useState<Record<keyof TeamClusterQueueConcurrencyInputDTO, string>>(createInitialValues(teamCluster));
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setValues(createInitialValues(teamCluster));
        setError(undefined);
    }, [teamCluster]);

    const clusterName = teamCluster?.name ?? 'cluster';
    const restartMessage = useMemo(() => {
        if (!teamCluster) {
            return 'Changes are saved in Volt and applied when the daemon next starts.';
        }

        if (teamCluster.status === TeamClusterStatus.Connected) {
            return 'Saving restarts the connected daemon so the new worker limits take effect.';
        }

        return 'The new worker limits are saved in Volt and will apply on the next daemon start.';
    }, [teamCluster]);

    const handleClose = () => {
        setValues(createInitialValues(teamCluster));
        setError(undefined);
        closeModal(CLUSTER_QUEUE_CONCURRENCY_MODAL_ID);
        onClose();
    };

    const handleFieldChange = (key: keyof TeamClusterQueueConcurrencyInputDTO, nextValue: string) => {
        setValues((currentValues) => ({
            ...currentValues,
            [key]: nextValue
        }));

        if (error) {
            setError(undefined);
        }
    };

    const parseValues = (): TeamClusterQueueConcurrencyInputDTO | null => {
        const parsedValues: TeamClusterQueueConcurrencyInputDTO = {
            analysis: 0,
            rasterizer: 0,
            glbPreprocessing: 0,
            sshImport: 0
        };

        for (const field of QUEUE_FIELDS) {
            const rawValue = values[field.key].trim();
            if (!/^\d+$/.test(rawValue)) {
                setError(`${field.label} concurrency must be an integer greater than or equal to ${MIN_CONCURRENCY}.`);
                return null;
            }

            const parsedValue = Number(rawValue);
            if (parsedValue < MIN_CONCURRENCY) {
                setError(`${field.label} concurrency must be greater than or equal to ${MIN_CONCURRENCY}.`);
                return null;
            }

            parsedValues[field.key] = parsedValue;
        }

        return parsedValues;
    };

    const handleSave = async () => {
        const queueConcurrency = parseValues();
        if (!queueConcurrency) {
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            await onSave(queueConcurrency);
            handleClose();
        } catch (err: unknown) {
            setError(reportError(err, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to save queue concurrency'
            }).title);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            id={CLUSTER_QUEUE_CONCURRENCY_MODAL_ID}
            title={`Queue concurrency for ${clusterName}`}
            description='Edit the per-cluster worker limits for all runtime queues.'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: isSubmitting
                    }}
                    primary={{
                        label: 'Save queue concurrency',
                        onClick: handleSave,
                        isLoading: isSubmitting
                    }}
                />
            )}
            onClose={handleClose}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <Container className='d-flex column gap-05'>
                    <Title className='font-size-2 font-weight-5 color-secondary'>Explicit queue limits</Title>
                    <Paragraph className='font-size-2 color-secondary'>{restartMessage}</Paragraph>
                </Container>
                <Container className='d-flex column gap-1'>
                    {QUEUE_FIELDS.map((field) => (
                        <Container key={field.key} className='d-flex column gap-025'>
                            <FormFieldRHF
                                label={field.label}
                                type='number'
                                value={values[field.key]}
                                onChange={(event) => handleFieldChange(field.key, event.target.value)}
                                inputProps={{
                                    min: MIN_CONCURRENCY,
                                    step: 1,
                                    inputMode: 'numeric'
                                }}
                            />
                            <Paragraph className='font-size-1 color-muted'>{field.description}</Paragraph>
                        </Container>
                    ))}
                </Container>
                {error && (
                    <Paragraph className='font-size-2 color-danger'>{error}</Paragraph>
                )}
            </Container>
        </Modal>
    );
};

export default ClusterQueueConcurrencyModal;
