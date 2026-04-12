import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { useEffect, useState } from 'react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type {
    TeamClusterQueueConcurrencyInputDTO,
    TeamClusterQueueScopeLimitInputDTO,
    TeamClusterQueueScopeLimitsInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-queue-concurrency';

interface QueueFieldDefinition {
    key: keyof TeamClusterQueueConcurrencyInputDTO;
    label: string;
    description: string;
};

interface QueueScopeFieldDefinition {
    key: keyof TeamClusterQueueScopeLimitsInputDTO;
    label: string;
    description: string;
}

interface ClusterQueueConcurrencyModalProps {
    teamCluster: TeamCluster | null;
    onSave: (input: {
        queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
        queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
    }) => Promise<UpdateTeamClusterQueueConcurrencyOutputDTO>;
    onClose: () => void;
};

const MIN_CONCURRENCY = 1;
const MIN_SCOPE_LIMIT = 0;

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

const QUEUE_SCOPE_FIELDS: QueueScopeFieldDefinition[] = [
    {
        key: 'analysisProcessing',
        label: 'Analysis processing',
        description: 'Workflow analysis execution slots'
    },
    {
        key: 'artifactUpload',
        label: 'Artifact upload',
        description: 'Artifact transfer jobs produced by analyses'
    },
    {
        key: 'trajectoryGlbConversion',
        label: 'GLB preprocessing',
        description: 'Trajectory model preprocessing jobs'
    },
    {
        key: 'cloudUpload',
        label: 'Cloud upload',
        description: 'Server-side dump upload jobs for the selected cluster'
    },
    {
        key: 'trajectoryCompression',
        label: 'Trajectory compression',
        description: 'Server-side zstd compression jobs for the selected cluster'
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

const createInitialScopeValues = (
    teamCluster: TeamCluster | null
): Record<keyof TeamClusterQueueScopeLimitsInputDTO, Record<keyof TeamClusterQueueScopeLimitInputDTO, string>> => {
    return {
        analysisProcessing: {
            maxRunningPerTrajectory: String(teamCluster?.queueScopeLimits.analysisProcessing.maxRunningPerTrajectory ?? ''),
            maxRunningPerTeam: String(teamCluster?.queueScopeLimits.analysisProcessing.maxRunningPerTeam ?? '')
        },
        artifactUpload: {
            maxRunningPerTrajectory: String(teamCluster?.queueScopeLimits.artifactUpload.maxRunningPerTrajectory ?? ''),
            maxRunningPerTeam: String(teamCluster?.queueScopeLimits.artifactUpload.maxRunningPerTeam ?? '')
        },
        trajectoryGlbConversion: {
            maxRunningPerTrajectory: String(teamCluster?.queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory ?? ''),
            maxRunningPerTeam: String(teamCluster?.queueScopeLimits.trajectoryGlbConversion.maxRunningPerTeam ?? '')
        },
        cloudUpload: {
            maxRunningPerTrajectory: String(teamCluster?.queueScopeLimits.cloudUpload.maxRunningPerTrajectory ?? ''),
            maxRunningPerTeam: String(teamCluster?.queueScopeLimits.cloudUpload.maxRunningPerTeam ?? '')
        },
        trajectoryCompression: {
            maxRunningPerTrajectory: String(teamCluster?.queueScopeLimits.trajectoryCompression.maxRunningPerTrajectory ?? ''),
            maxRunningPerTeam: String(teamCluster?.queueScopeLimits.trajectoryCompression.maxRunningPerTeam ?? '')
        }
    };
};

const ClusterQueueConcurrencyModal = ({ teamCluster, onSave, onClose }: ClusterQueueConcurrencyModalProps) => {
    const [values, setValues] = useState<Record<keyof TeamClusterQueueConcurrencyInputDTO, string>>(createInitialValues(teamCluster));
    const [scopeValues, setScopeValues] = useState<
        Record<keyof TeamClusterQueueScopeLimitsInputDTO, Record<keyof TeamClusterQueueScopeLimitInputDTO, string>>
    >(createInitialScopeValues(teamCluster));
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setValues(createInitialValues(teamCluster));
        setScopeValues(createInitialScopeValues(teamCluster));
        setError(undefined);
    }, [teamCluster]);

    const clusterName = teamCluster?.name ?? 'cluster';

    const handleClose = () => {
        setValues(createInitialValues(teamCluster));
        setScopeValues(createInitialScopeValues(teamCluster));
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

    const handleScopeFieldChange = (
        key: keyof TeamClusterQueueScopeLimitsInputDTO,
        scopeKey: keyof TeamClusterQueueScopeLimitInputDTO,
        nextValue: string
    ) => {
        setScopeValues((currentValues) => ({
            ...currentValues,
            [key]: {
                ...currentValues[key],
                [scopeKey]: nextValue
            }
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

    const parseScopeValues = (): TeamClusterQueueScopeLimitsInputDTO | null => {
        const parsedValues = {} as TeamClusterQueueScopeLimitsInputDTO;

        for (const field of QUEUE_SCOPE_FIELDS) {
            const currentValues = scopeValues[field.key];
            const parsedField = {} as TeamClusterQueueScopeLimitInputDTO;

            for (const scopeKey of ['maxRunningPerTrajectory', 'maxRunningPerTeam'] as const) {
                const rawValue = currentValues[scopeKey].trim();
                if (!/^\d+$/.test(rawValue)) {
                    setError(`${field.label} ${scopeKey === 'maxRunningPerTrajectory' ? 'max per trajectory' : 'max per team'} must be an integer greater than or equal to ${MIN_SCOPE_LIMIT}.`);
                    return null;
                }

                const parsedValue = Number(rawValue);
                if (parsedValue < MIN_SCOPE_LIMIT) {
                    setError(`${field.label} ${scopeKey === 'maxRunningPerTrajectory' ? 'max per trajectory' : 'max per team'} must be greater than or equal to ${MIN_SCOPE_LIMIT}.`);
                    return null;
                }

                parsedField[scopeKey] = parsedValue;
            }

            parsedValues[field.key] = parsedField;
        }

        return parsedValues;
    };

    const handleSave = async () => {
        const queueConcurrency = parseValues();
        if (!queueConcurrency) {
            return;
        }

        const queueScopeLimits = parseScopeValues();
        if (!queueScopeLimits) {
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            await onSave({
                queueConcurrency,
                queueScopeLimits
            });
            handleClose();
        } catch (err: unknown) {
            setError(reportError(err, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to save queue settings'
            }).title);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            id={CLUSTER_QUEUE_CONCURRENCY_MODAL_ID}
            title={`Queue settings for ${clusterName}`}
            description='Edit per-cluster worker concurrency and execution scope limits for runtime queues.'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: isSubmitting
                    }}
                    primary={{
                        label: 'Save queue settings',
                        onClick: handleSave,
                        isLoading: isSubmitting
                    }}
                />
            )}
            onClose={handleClose}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <Container className='d-flex column gap-05'>
                    <Title className='font-size-2 font-weight-5 color-secondary'>Worker concurrency</Title>
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
                <Container className='d-flex column gap-05 mt-05'>
                    <Title className='font-size-2 font-weight-5 color-secondary'>Execution scope limits</Title>
                </Container>
                <Container className='d-flex column gap-1'>
                    {QUEUE_SCOPE_FIELDS.map((field) => (
                        <Container key={field.key} className='d-flex column gap-05'>
                            <Title className='font-size-2 font-weight-5 color-secondary'>{field.label}</Title>
                            <Paragraph className='font-size-1 color-muted'>{field.description}</Paragraph>
                            <Container className='d-flex items-start gap-1 flex-wrap'>
                                <FormFieldRHF
                                    label='Max per trajectory'
                                    type='number'
                                    value={scopeValues[field.key].maxRunningPerTrajectory}
                                    onChange={(event) => handleScopeFieldChange(field.key, 'maxRunningPerTrajectory', event.target.value)}
                                    inputProps={{
                                        min: MIN_SCOPE_LIMIT,
                                        step: 1,
                                        inputMode: 'numeric'
                                    }}
                                />
                                <FormFieldRHF
                                    label='Max per team'
                                    type='number'
                                    value={scopeValues[field.key].maxRunningPerTeam}
                                    onChange={(event) => handleScopeFieldChange(field.key, 'maxRunningPerTeam', event.target.value)}
                                    inputProps={{
                                        min: MIN_SCOPE_LIMIT,
                                        step: 1,
                                        inputMode: 'numeric'
                                    }}
                                />
                            </Container>
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
