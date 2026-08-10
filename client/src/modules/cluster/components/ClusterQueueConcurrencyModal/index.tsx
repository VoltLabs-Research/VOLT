import { ErrorSurface, reportError } from '@/shared/errors/core';
import ClusterModalActionFooter from '@/modules/cluster/components/shared/ClusterModalActionFooter';
import { Disclosure } from '@heroui/react';
import { Modal, closeModal } from '@/shared/ui/modal';
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

/**
 * bravais's `Table` was a plain `<table>` inside an x-scrolling wrapper, and these
 * are its own metrics from `Table.css` — kept rather than handed to HeroUI's
 * `Table` family, which is a RAC grid: it would add row focus management and its
 * own scroll container around what is a two-column, four-row static list holding a
 * number input, and it never sorted, never loaded, and never had clickable rows.
 * Reproducing it costs three class constants.
 *
 * `aria-sort` is the one thing deliberately not carried over. bravais emitted it on
 * every `th`, defaulting to `'none'` even for non-sortable columns, which is
 * invalid ARIA; nothing here sorts.
 */
const TABLE_WRAPPER_CLASS = 'w-full overflow-x-auto';

const TABLE_HEAD_CLASS = 'text-left px-4 py-2.5 text-[0.6875rem] font-medium text-muted uppercase tracking-[0.06em] border-b border-border whitespace-nowrap';

const TABLE_CELL_CLASS = 'px-4 py-2.5 border-b border-border text-foreground text-[0.8125rem]';

/**
 * `.form-field-input` used to reach this input from `FormFieldRHF`'s stylesheet.
 * That sheet is gone and the class carries nothing, so the field's own inline text
 * metrics are restated here — the same declarations `field-styles.ts` gives an
 * inline text control, at the 8px radius bravais's `rounded-lg` meant (spec §3b).
 */
const SCOPE_LIMIT_INPUT_CLASS = 'w-20 min-w-0 px-3 py-[0.4375rem] border border-border rounded-lg bg-transparent text-foreground text-sm placeholder:text-muted focus:border-accent';

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
                {/*
                  * bravais's `CollapsibleSection` → HeroUI `Disclosure` (spec §4c).
                  * `titleAs='h3'` is the heading's `level`, `noSpacing` dropped the
                  * section's `mb-6`, and the section was collapsed on first render —
                  * `Disclosure` is collapsed by default too, so there is no
                  * `defaultExpanded` to restate.
                  *
                  * Two behaviour changes, both from HeroUI rather than from this edit:
                  * the panel now animates its height (bravais flipped between `0` and
                  * `auto` with `transition: none`), and the body mounts and unmounts with
                  * the panel instead of mounting once on first expand and staying. Neither
                  * matters here — the fields are controlled from `scopeValues` above, so
                  * nothing lives inside the panel that could be lost.
                  */}
                <Disclosure>
                    <Disclosure.Heading level={3}>
                        <Disclosure.Trigger>
                            Execution scope limits
                            <Disclosure.Indicator />
                        </Disclosure.Trigger>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                        <Disclosure.Body>
                            <div className='flex flex-col gap-2 mt-2'>
                                <p className='text-xs text-muted'>Per-trajectory limits. Use 0 for no limit.</p>
                                <div className={TABLE_WRAPPER_CLASS}>
                                    <table className='w-full border-collapse'>
                                        <thead>
                                            <tr>
                                                <th scope='col' className={TABLE_HEAD_CLASS}>Queue</th>
                                                <th scope='col' className={TABLE_HEAD_CLASS}>Max / trajectory</th>
                                            </tr>
                                        </thead>
                                        <tbody className='[&_tr:last-child_td]:border-b-0'>
                                            {QUEUE_SCOPE_FIELDS.map((row) => (
                                                <tr className='hover:bg-surface-hover' key={row.key}>
                                                    <td className={TABLE_CELL_CLASS}>
                                                        <span className='text-xs font-medium'>{row.label}</span>
                                                    </td>
                                                    <td className={TABLE_CELL_CLASS}>
                                                        <input
                                                            type='number'
                                                            min={MIN_SCOPE_LIMIT}
                                                            step={1}
                                                            inputMode='numeric'
                                                            aria-label={`${row.label} max per trajectory`}
                                                            className={SCOPE_LIMIT_INPUT_CLASS}
                                                            value={scopeValues[row.key].maxRunningPerTrajectory}
                                                            onChange={(e) => handleScopeFieldChange(row.key, e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Disclosure.Body>
                    </Disclosure.Content>
                </Disclosure>
                {error && (
                    <p className='text-sm text-danger'>{error}</p>
                )}
            </div>
        </Modal>
    );
};

export default ClusterQueueConcurrencyModal;
