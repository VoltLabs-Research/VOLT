import { ErrorSurface, reportError } from '@/shared/errors/core';
import ClusterModalActionFooter from '@/modules/cluster/components/shared/ClusterModalActionFooter';
import { CollapsibleSection, Modal, closeModal, Table } from '@voltstack/bravais';
import type { Column } from '@voltstack/bravais';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { useEffect, useState } from 'react';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';
import type { TeamClusterQueueConcurrency, TeamClusterQueueScopeLimit, TeamClusterQueueScopeLimits, UpdateTeamClusterQueueConcurrencyResponse } from '@volt/contracts/modules/cluster/domain';

interface QueueFieldDefinition {
    key: keyof TeamClusterQueueConcurrency;
    label: string;
    description: string;
}

interface QueueScopeFieldDefinition {
    key: keyof TeamClusterQueueScopeLimits;
    label: string;
}

type QueueConcurrencyValues = Record<keyof TeamClusterQueueConcurrency, string>;
type QueueScopeLimitValues = Record<keyof TeamClusterQueueScopeLimit, string>;
type QueueScopeValues = Record<keyof TeamClusterQueueScopeLimits, QueueScopeLimitValues>;

interface ClusterQueueConcurrencyModalProps {
    teamCluster: TeamCluster | null;
    onSave: (input: {
        queueConcurrency: TeamClusterQueueConcurrency;
        queueScopeLimits: TeamClusterQueueScopeLimits;
    }) => Promise<UpdateTeamClusterQueueConcurrencyResponse>;
    onClose: () => void;
}

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
        key: 'artifactUpload',
        label: 'Artifact upload',
        description: 'Analysis artifact upload jobs'
    },
    {
        key: 'pluginWarmup',
        label: 'Plugin warmup',
        description: 'Plugin binary preparation jobs'
    }
];

const QUEUE_SCOPE_FIELDS: QueueScopeFieldDefinition[] = [
    {
        key: 'analysisProcessing',
        label: 'Analysis processing'
    },
    {
        key: 'artifactUpload',
        label: 'Artifact upload'
    },
    {
        key: 'trajectoryRasterization',
        label: 'Rasterization'
    },
    {
        key: 'trajectoryGlbConversion',
        label: 'GLB preprocessing'
    }
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

    const handleFieldChange = (key: keyof TeamClusterQueueConcurrency, nextValue: string) => {
        setValues((currentValues) => ({
            ...currentValues,
            [key]: nextValue
        }));

        if (error) {
            setError(undefined);
        }
    };

    const handleScopeFieldChange = (
        key: keyof TeamClusterQueueScopeLimits,
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

    const parseValues = (): TeamClusterQueueConcurrency | null => {
        const parsedValues: TeamClusterQueueConcurrency = {
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

    const parseScopeValues = (): TeamClusterQueueScopeLimits | null => {
        const parsedValues = {} as TeamClusterQueueScopeLimits;

        for (const field of QUEUE_SCOPE_FIELDS) {
            const currentValues = scopeValues[field.key];
            const rawValue = currentValues.maxRunningPerTrajectory.trim();
            if (!/^\d+$/.test(rawValue)) {
                setError(`${field.label} max per trajectory must be an integer greater than or equal to ${MIN_SCOPE_LIMIT}.`);
                return null;
            }

            parsedValues[field.key] = {
                maxRunningPerTrajectory: Number(rawValue)
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
            render: (row) => <span className='text-xs font-medium'>{row.label}</span>
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
                    className='form-field-input rounded-lg'
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
            <div className='flex flex-col gap-4 p-6'>
                <div className='flex flex-col gap-4'>
                    {QUEUE_FIELDS.map((field) => (
                        <div className='flex flex-col gap-1' key={field.key}>
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
                            <p className='text-xs text-muted'>{field.description}</p>
                        </div>
                    ))}
                </div>
                <CollapsibleSection
                    title='Execution scope limits'
                    titleAs='h3'
                    noSpacing
                >
                    <div className='flex flex-col gap-2 mt-2'>
                        <p className='text-xs text-muted'>Per-trajectory limits. Use 0 for no limit.</p>
                        <Table
                            columns={scopeColumns}
                            data={QUEUE_SCOPE_FIELDS}
                            getRowKey={(row) => row.key}
                        />
                    </div>
                </CollapsibleSection>
                {error && (
                    <p className='text-sm text-danger'>{error}</p>
                )}
            </div>
        </Modal>
    );
};

export default ClusterQueueConcurrencyModal;
