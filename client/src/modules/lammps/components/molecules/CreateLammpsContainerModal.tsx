import { useClusterResourceLimitsQuery } from '@/modules/container/hooks/queries';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Slider from '@/shared/presentation/components/Slider';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { lammpsRunClustersQuery, useCreateLammpsContainerMutation } from '@/modules/lammps/hooks/queries';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cpu } from 'lucide-react';
import type { LammpsContainer, LammpsContainerProgressEvent } from '@/modules/lammps/api/types';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface CreateLammpsContainerModalProps {
    id: string;
    teamId: string | null;
    packages: string[];
    onCreated?: (container: LammpsContainer) => void;
}

interface ProgressEntry {
    stage: string;
    message: string;
    timestamp: string;
    status: string;
}

const isTerminalContainerStatus = (status?: string): boolean => {
    return status === 'ready' || status === 'failed';
};

const buildProgressMessage = (event: LammpsContainerProgressEvent): string => {
    return event.message || event.step || event.stage;
};

const CreateLammpsContainerModal = ({
    id,
    teamId,
    packages,
    onCreated
}: CreateLammpsContainerModalProps) => {
    const socketService = useSocket();
    const createContainerMutation = useCreateLammpsContainerMutation();
    const runClustersQuery = lammpsRunClustersQuery({ teamId: teamId ?? '' }, {
        enabled: Boolean(teamId)
    });
    const packageOptions = useMemo(() => packages.map((pkg) => ({
        value: pkg,
        title: pkg
    })), [packages]);
    const runClusterOptions = useMemo(() => {
        return (runClustersQuery.data ?? []).map((cluster) => ({
            value: cluster._id,
            title: cluster.name,
            description: cluster.effectiveRole
        }));
    }, [runClustersQuery.data]);

    const [name, setName] = useState('');
    const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
    const [selectedTeamClusterId, setSelectedTeamClusterId] = useState<string | null>(null);
    const [cpus, setCpus] = useState(1);
    const [error, setError] = useState<string | undefined>();
    const [createdContainer, setCreatedContainer] = useState<LammpsContainer | null>(null);
    const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
    const clusterResourceLimitsQuery = useClusterResourceLimitsQuery({
        teamId: teamId ?? '',
        teamClusterId: selectedTeamClusterId ?? ''
    }, {
        enabled: Boolean(teamId) && Boolean(selectedTeamClusterId)
    });
    const maxCpus = useMemo(() => {
        const rawMaxCpus = clusterResourceLimitsQuery.data?.maxCpus;
        if (typeof rawMaxCpus !== 'number' || !Number.isFinite(rawMaxCpus) || rawMaxCpus < 1) {
            return null;
        }

        return Math.max(1, Math.floor(rawMaxCpus));
    }, [clusterResourceLimitsQuery.data?.maxCpus]);

    const resetState = useCallback(() => {
        setName('');
        setSelectedPackages([]);
        setSelectedTeamClusterId(runClusterOptions[0]?.value ?? null);
        setCpus(1);
        setError(undefined);
        setCreatedContainer(null);
        setProgressEntries([]);
    }, [runClusterOptions]);

    useEffect(() => {
        setSelectedTeamClusterId((current) => {
            if (current && runClusterOptions.some((cluster) => cluster.value === current)) {
                return current;
            }

            return runClusterOptions[0]?.value ?? null;
        });
    }, [runClusterOptions]);

    useEffect(() => {
        if (!maxCpus) {
            setCpus(1);
            return;
        }

        setCpus((current) => Math.min(Math.max(1, Math.floor(current)), maxCpus));
    }, [maxCpus]);

    useEffect(() => {
        const unsubscribe = socketService.on('lammps_container_progress', (payload) => {
            const event = payload as LammpsContainerProgressEvent;
            if (!createdContainer) {
                return;
            }

            const sameContainer = event.lammpsContainerId === createdContainer._id;
            const sameOperation = Boolean(createdContainer.operationId) && event.operationId === createdContainer.operationId;
            if (!sameContainer && !sameOperation) {
                return;
            }

            setCreatedContainer((current) => current
                ? {
                    ...current,
                    status: event.status,
                    imageTag: event.imageTag ?? current.imageTag,
                    imageHash: event.imageHash ?? current.imageHash,
                    workspaceContainerId: event.workspaceContainerId ?? current.workspaceContainerId,
                    workspaceContainerName: event.workspaceContainerName ?? current.workspaceContainerName,
                    lastError: event.message ?? current.lastError
                }
                : current
            );
            setProgressEntries((current) => {
                const nextEntry: ProgressEntry = {
                    stage: event.stage,
                    message: buildProgressMessage(event),
                    timestamp: event.timestamp,
                    status: event.status
                };

                if (current.some((entry) => entry.stage === nextEntry.stage && entry.timestamp === nextEntry.timestamp)) {
                    return current;
                }

                return [...current, nextEntry];
            });
        });

        return unsubscribe;
    }, [createdContainer, socketService]);

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const handleModalClose = useCallback(() => {
        resetState();
    }, [resetState]);

    const handleSubmit = useCallback(async () => {
        if (!teamId) {
            return;
        }

        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('Container name is required.');
            return;
        }

        if (!selectedTeamClusterId) {
            setError('Select a cluster to continue.');
            return;
        }

        if (!maxCpus) {
            setError('Cluster metrics are not available yet, so cores cannot be configured.');
            return;
        }

        setError(undefined);

        try {
            const container = await createContainerMutation.mutateAsync({
                teamId,
                name: trimmedName,
                packages: selectedPackages,
                teamClusterId: selectedTeamClusterId,
                cpus
            });

            setCreatedContainer(container);
            setProgressEntries([
                {
                    stage: 'queued',
                    message: 'Provision request accepted.',
                    timestamp: new Date().toISOString(),
                    status: container.status
                }
            ]);
            onCreated?.(container);
        } catch (nextError) {
            const userError = reportError(nextError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to create container'
            });
            setError(userError.description ?? userError.title);
        }
    }, [cpus, createContainerMutation, maxCpus, name, onCreated, selectedPackages, selectedTeamClusterId, teamId]);

    const secondaryAction: ModalFooterAction = {
        label: createdContainer && isTerminalContainerStatus(createdContainer.status) ? 'Close' : 'Cancel',
        onClick: handleRequestClose,
        disabled: createContainerMutation.isPending
    };

    const primaryAction: ModalFooterAction = {
        label: createdContainer ? 'Provisioning...' : 'Create Container',
        onClick: () => {
            void handleSubmit();
        },
        disabled: !teamId || createContainerMutation.isPending || Boolean(createdContainer) || !selectedTeamClusterId || !maxCpus,
        isLoading: createContainerMutation.isPending
    };

    return (
        <Modal
            id={id}
            title='Create LAMMPS Container'
            description='Choose a name and the LAMMPS packages that should be included in the runtime image.'
            onClose={handleModalClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <FormFieldRHF
                    label='Container name'
                    placeholder='For example: production-reaxff'
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value);
                        setError(undefined);
                    }}
                    error={error}
                    disabled={Boolean(createdContainer)}
                />

                <Container className='d-flex column gap-05'>
                    <Paragraph className='font-size-2 color-secondary'>Packages</Paragraph>
                    <Select
                        options={packageOptions}
                        isMulti
                        hasSearch
                        searchPlaceholder='Search packages...'
                        selectedValues={selectedPackages}
                        onMultiChange={setSelectedPackages}
                        placeholder='Select packages'
                        disabled={Boolean(createdContainer)}
                        renderTriggerLabel={(selectedCount) => {
                            return selectedCount === 0
                                ? 'No packages selected'
                                : `${selectedCount} package${selectedCount === 1 ? '' : 's'} selected`;
                        }}
                    />
                    <Paragraph className='font-size-1 color-muted'>
                        Leaving the selection empty builds the default runtime without optional packages.
                    </Paragraph>
                </Container>

                <Container className='d-flex column gap-1 p-1' style={{ border: '1px solid var(--color-border-primary)', borderRadius: '0.9rem' }}>
                    <SettingsSectionHeader
                        title='Cluster resources'
                        description='Choose the compute cluster and the number of cores reserved for the LAMMPS workspace container.'
                        headingAs='h3'
                    />

                    <Container className='d-flex column gap-05'>
                        <Paragraph className='font-size-2 color-secondary'>Cluster</Paragraph>
                        <Select
                            options={runClusterOptions}
                            value={selectedTeamClusterId}
                            onChange={(value) => {
                                setSelectedTeamClusterId(value);
                                setError(undefined);
                            }}
                            placeholder='Select cluster'
                            disabled={Boolean(createdContainer) || runClusterOptions.length === 0}
                        />
                    </Container>

                    {!selectedTeamClusterId ? (
                        <Paragraph className='font-size-1 color-muted'>
                            Select a cluster to load its available cores.
                        </Paragraph>
                    ) : clusterResourceLimitsQuery.isLoading ? (
                        <Paragraph className='font-size-1 color-muted'>
                            Loading cluster core capacity...
                        </Paragraph>
                    ) : !maxCpus ? (
                        <Paragraph className='font-size-1 color-muted'>
                            Cluster metrics are not available yet. Wait for the next heartbeat to configure cores.
                        </Paragraph>
                    ) : (
                        <Container className='d-flex column gap-075'>
                            <Container className='d-flex items-center content-between gap-1'>
                                <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                    <Cpu size={16} />
                                    Cores
                                </span>
                                <span className='font-size-2 font-weight-6 color-primary'>
                                    {cpus}
                                </span>
                            </Container>
                            <Slider
                                min={1}
                                max={maxCpus}
                                step={1}
                                value={cpus}
                                onChange={(value) => {
                                    setCpus(Math.max(1, Math.floor(value)));
                                    setError(undefined);
                                }}
                                disabled={Boolean(createdContainer)}
                            />
                            <Container className='d-flex content-between font-size-1 color-muted'>
                                <span>1</span>
                                <span>{maxCpus}</span>
                            </Container>
                        </Container>
                    )}
                </Container>

                {createdContainer && (
                    <Container className='d-flex column gap-075 p-1' style={{ border: '1px solid var(--color-border-primary)', borderRadius: '0.9rem' }}>
                        <Container className='d-flex items-center content-between gap-1'>
                            <Paragraph className='font-size-2 color-secondary'>Provision status</Paragraph>
                            <StatusBadge status={createdContainer.status} />
                        </Container>
                        <Paragraph className='font-size-2 color-muted'>
                            {createdContainer.lastError || 'Streaming build and workspace preparation events in real time.'}
                        </Paragraph>
                        <Container className='d-flex column gap-05' style={{ maxHeight: '14rem', overflowY: 'auto' }}>
                            {progressEntries.map((entry, index) => (
                                <Container key={`${entry.stage}:${entry.timestamp}:${index}`} className='d-flex items-start gap-075'>
                                    <StatusBadge status={entry.status} size='compact' />
                                    <Container className='d-flex column gap-025'>
                                        <span className='font-size-2 color-secondary'>{entry.message}</span>
                                        <span className='font-size-1 color-muted'>{new Date(entry.timestamp).toLocaleString()}</span>
                                    </Container>
                                </Container>
                            ))}
                        </Container>
                    </Container>
                )}
            </Container>
        </Modal>
    );
};

export default CreateLammpsContainerModal;
