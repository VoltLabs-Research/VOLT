import { ErrorSurface, reportError } from '@/shared/errors/core';
import Button from '@/shared/presentation/primitives/Button';
import ClusterModalActionFooter from '@/modules/cluster/components/shared/ClusterModalActionFooter';
import Heading from '@/shared/presentation/primitives/Heading';
import Modal, { closeModal } from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
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
}

interface QueueScopeFieldDefinition {
    key: keyof TeamClusterQueueScopeLimitsInputDTO;
    label: string;
    description: string;
}

type QueueConcurrencyValues = Record<keyof TeamClusterQueueConcurrencyInputDTO, string>;
type QueueScopeLimitValues = Record<keyof TeamClusterQueueScopeLimitInputDTO, string>;
type QueueScopeValues = Record<keyof TeamClusterQueueScopeLimitsInputDTO, QueueScopeLimitValues>;

interface ClusterQueueConcurrencyModalProps {
    teamCluster: TeamCluster | null;
    onSave: (input: {
        queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
        queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
    }) => Promise<UpdateTeamClusterQueueConcurrencyOutputDTO>;
    onClose: () => void;
}

const MIN_CONCURRENCY = 1;
const MIN_SCOPE_LIMIT = 0;
const RECOMMENDED_QUEUE_CONCURRENCY: TeamClusterQueueConcurrencyInputDTO = {
    analysis: 8,
    rasterizer: 5,
    glbPreprocessing: 8,
    artifactUpload: 8,
    sshImport: 2
};
const RECOMMENDED_QUEUE_SCOPE_LIMITS: TeamClusterQueueScopeLimitsInputDTO = {
    analysisProcessing: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    artifactUpload: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    trajectoryRasterization: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    trajectoryGlbConversion: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    cloudUpload: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    },
    trajectoryCompression: {
        maxRunningPerTrajectory: 0,
        maxRunningPerTeam: 0
    }
};

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
        key: 'artifactUpload',
        label: 'Artifact upload',
        description: 'Analysis artifact upload jobs'
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
        key: 'trajectoryRasterization',
        label: 'Rasterization',
        description: 'Trajectory preview generation jobs'
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
const QUEUE_SCOPE_LIMIT_KEYS = ['maxRunningPerTrajectory', 'maxRunningPerTeam'] as const;

export const CLUSTER_QUEUE_CONCURRENCY_MODAL_ID = 'cluster-queue-concurrency-modal';

const createQueueValues = (source?: TeamClusterQueueConcurrencyInputDTO): QueueConcurrencyValues => {
    return Object.fromEntries(
        QUEUE_FIELDS.map((field) => [field.key, String(source?.[field.key] ?? '')])
    ) as QueueConcurrencyValues;
};

const createInitialValues = (teamCluster: TeamCluster | null): QueueConcurrencyValues => {
    return createQueueValues(teamCluster?.queueConcurrency);
};

const createRecommendedValues = (): QueueConcurrencyValues => {
    return createQueueValues(RECOMMENDED_QUEUE_CONCURRENCY);
};

const createScopeValues = (source?: TeamClusterQueueScopeLimitsInputDTO): QueueScopeValues => {
    return Object.fromEntries(
        QUEUE_SCOPE_FIELDS.map((field) => [
            field.key,
            Object.fromEntries(
                QUEUE_SCOPE_LIMIT_KEYS.map((scopeKey) => [scopeKey, String(source?.[field.key]?.[scopeKey] ?? '')])
            )
        ])
    ) as QueueScopeValues;
};

const createInitialScopeValues = (teamCluster: TeamCluster | null): QueueScopeValues => {
    return createScopeValues(teamCluster?.queueScopeLimits);
};

const createRecommendedScopeValues = (): QueueScopeValues => {
    return createScopeValues(RECOMMENDED_QUEUE_SCOPE_LIMITS);
};

const ClusterQueueConcurrencyModal = ({ teamCluster, onSave, onClose }: ClusterQueueConcurrencyModalProps) => {
    const [values, setValues] = useState<QueueConcurrencyValues>(createInitialValues(teamCluster));
    const [scopeValues, setScopeValues] = useState<QueueScopeValues>(createInitialScopeValues(teamCluster));
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setValues(createInitialValues(teamCluster));
        setScopeValues(createInitialScopeValues(teamCluster));
        setError(undefined);
    }, [teamCluster]);

    const clusterName = teamCluster?.name ?? 'cluster';

    const handleApplyRecommended = () => {
        setValues(createRecommendedValues());
        setScopeValues(createRecommendedScopeValues());
        setError(undefined);
    };

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
            artifactUpload: 0,
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

            for (const scopeKey of QUEUE_SCOPE_LIMIT_KEYS) {
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

    const footer = (
        <ClusterModalActionFooter
            confirmLabel='Save queue settings'
            onCancel={handleClose}
            onConfirm={handleSave}
            isSubmitting={isSubmitting}
        />
    );

    return (
        <Modal id={CLUSTER_QUEUE_CONCURRENCY_MODAL_ID} title={`Queue settings for ${clusterName}`} description='Edit per-cluster worker concurrency and execution scope limits for runtime queues.' footer={footer} onClose={handleClose}>
            <Stack gap='1' p='1-5'>
                <Stack gap='05'>
                    <Heading level={3} size='md' weight='medium' tone='secondary'>Worker concurrency</Heading>
                    <Row gap='075' wrap>
                        <Text as='p' size='sm' tone='muted'>Use the recommended preset to auto-fill balanced high-throughput limits for this cluster.</Text>
                        <Button
                            variant='outline'
                            intent='brand'
                            size='sm'
                            onClick={handleApplyRecommended}
                            disabled={isSubmitting}
                        >
                            Apply recommended
                        </Button>
                    </Row>
                </Stack>
                <Stack gap='1'>
                    {QUEUE_FIELDS.map((field) => (
                        <Stack key={field.key} gap='025'>
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
                            <Text as='p' size='sm' tone='muted'>{field.description}</Text>
                        </Stack>
                    ))}
                </Stack>
                <Stack gap='05' mt='05'>
                    <Heading level={3} size='md' weight='medium' tone='secondary'>Execution scope limits</Heading>
                    <Text as='p' size='sm' tone='muted'>Limits are enforced per cluster. Use 0 for no limit.</Text>
                </Stack>
                <Stack gap='1'>
                    {QUEUE_SCOPE_FIELDS.map((field) => (
                        <Stack key={field.key} gap='05'>
                            <Heading level={3} size='md' weight='medium' tone='secondary'>{field.label}</Heading>
                            <Text as='p' size='sm' tone='muted'>{field.description}</Text>
                            <Row align='start' gap='1' wrap>
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
                            </Row>
                        </Stack>
                    ))}
                </Stack>
                {error && (
                    <Text as='p' size='md' className='color-danger'>{error}</Text>
                )}
            </Stack>
        </Modal>
    );
};

export default ClusterQueueConcurrencyModal;
