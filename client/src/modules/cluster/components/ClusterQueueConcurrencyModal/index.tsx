import { ErrorSurface, reportError } from '@/shared/errors/core';
import ClusterModalActionFooter from '@/modules/cluster/components/shared/ClusterModalActionFooter';
import CollapsibleSection from '@/shared/presentation/primitives/CollapsibleSection';
import Modal, { closeModal } from '@/shared/presentation/primitives/Modal';
import Stack from '@/shared/presentation/primitives/Stack';
import Table from '@/shared/presentation/primitives/Table';
import Text from '@/shared/presentation/primitives/Text';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { useEffect, useState } from 'react';
import type { Column } from '@/shared/presentation/primitives/Table';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type {
    TeamClusterQueueConcurrencyInputDTO,
    TeamClusterQueueScopeLimitInputDTO,
    TeamClusterQueueScopeLimitsInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@/modules/cluster/api/service';

interface QueueFieldDefinition {
    key: keyof TeamClusterQueueConcurrencyInputDTO;
    label: string;
    description: string;
}

interface QueueScopeFieldDefinition {
    key: keyof TeamClusterQueueScopeLimitsInputDTO;
    label: string;
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

const QUEUE_FIELDS: QueueFieldDefinition[] = [
    { key: 'analysis', label: 'Analysis', description: 'Workflow analysis jobs' },
    { key: 'rasterizer', label: 'Rasterizer', description: 'Trajectory preview generation' },
    { key: 'glbPreprocessing', label: 'GLB preprocessing', description: 'Trajectory model preprocessing' },
    { key: 'artifactUpload', label: 'Artifact upload', description: 'Analysis artifact upload jobs' },
    { key: 'pluginWarmup', label: 'Plugin warmup', description: 'Plugin binary preparation jobs' }
];

const QUEUE_SCOPE_FIELDS: QueueScopeFieldDefinition[] = [
    { key: 'analysisProcessing', label: 'Analysis processing' },
    { key: 'artifactUpload', label: 'Artifact upload' },
    { key: 'trajectoryRasterization', label: 'Rasterization' },
    { key: 'trajectoryGlbConversion', label: 'GLB preprocessing' }
];

export const CLUSTER_QUEUE_CONCURRENCY_MODAL_ID = 'cluster-queue-concurrency-modal';

const createInitialValues = (teamCluster: TeamCluster | null): QueueConcurrencyValues => {
    const source = teamCluster?.queueConcurrency;
    return Object.fromEntries(
        QUEUE_FIELDS.map((field) => [field.key, String(source?.[field.key] ?? '')])
    ) as QueueConcurrencyValues;
};

const createInitialScopeValues = (teamCluster: TeamCluster | null): QueueScopeValues => {
    const source = teamCluster?.queueScopeLimits;
    return Object.fromEntries(
        QUEUE_SCOPE_FIELDS.map((field) => [
            field.key,
            {
                maxRunningPerTrajectory: String(source?.[field.key]?.maxRunningPerTrajectory ?? '')
            }
        ])
    ) as QueueScopeValues;
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
        nextValue: string
    ) => {
        setScopeValues((currentValues) => ({
            ...currentValues,
            [key]: {
                ...currentValues[key],
                maxRunningPerTrajectory: nextValue
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
            pluginWarmup: 0
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
            const rawValue = currentValues.maxRunningPerTrajectory.trim();
            if (!/^\d+$/.test(rawValue)) {
                setError(`${field.label} max per trajectory must be an integer greater than or equal to ${MIN_SCOPE_LIMIT}.`);
                return null;
            }

            const parsedValue = Number(rawValue);
            if (parsedValue < MIN_SCOPE_LIMIT) {
                setError(`${field.label} max per trajectory must be greater than or equal to ${MIN_SCOPE_LIMIT}.`);
                return null;
            }

            parsedValues[field.key] = {
                maxRunningPerTrajectory: parsedValue
            };
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

    const scopeColumns: Column<QueueScopeFieldDefinition>[] = [
        {
            key: 'label',
            header: 'Queue',
            render: (row) => <Text as='span' size='sm' weight='medium'>{row.label}</Text>
        },
        {
            key: 'maxPerTrajectory',
            header: 'Max / trajectory',
            render: (row) => (
                <input
                    type='number'
                    min={MIN_SCOPE_LIMIT}
                    step={1}
                    inputMode='numeric'
                    className='form-field-input radius-sm'
                    style={{ width: '5rem' }}
                    value={scopeValues[row.key].maxRunningPerTrajectory}
                    onChange={(e) => handleScopeFieldChange(row.key, e.target.value)}
                />
            )
        }
    ];

    const footer = (
        <ClusterModalActionFooter
            confirmLabel='Save queue settings'
            onCancel={handleClose}
            onConfirm={handleSave}
            isSubmitting={isSubmitting}
        />
    );

    return (
        <Modal id={CLUSTER_QUEUE_CONCURRENCY_MODAL_ID} title={`Queue settings for ${clusterName}`} description='Configure worker concurrency for runtime queues.' footer={footer} onClose={handleClose}>
            <Stack gap='1' p='1-5'>
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
                <CollapsibleSection
                    title='Execution scope limits'
                    titleAs='h3'
                    noSpacing
                >
                    <Stack gap='05' mt='05'>
                        <Text as='p' size='sm' tone='muted'>Per-trajectory limits. Use 0 for no limit.</Text>
                        <Table
                            columns={scopeColumns}
                            data={QUEUE_SCOPE_FIELDS}
                            getRowKey={(row) => row.key}
                        />
                    </Stack>
                </CollapsibleSection>
                {error && (
                    <Text as='p' size='md' className='color-danger'>{error}</Text>
                )}
            </Stack>
        </Modal>
    );
};

export default ClusterQueueConcurrencyModal;
