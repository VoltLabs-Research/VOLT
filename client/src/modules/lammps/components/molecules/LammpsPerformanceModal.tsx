import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Paragraph from '@/shared/presentation/components/Paragraph';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Slider from '@/shared/presentation/components/Slider';
import { Cpu } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface LammpsPerformanceModalProps {
    id: string;
    mpiRanks: number;
    openmpThreads: number;
    maxCpus: number | null;
    clusterName?: string | null;
    isLoadingLimits: boolean;
    isSubmitting: boolean;
    onSubmit: (config: {
        mpiRanks: number;
        openmpThreads: number;
    }) => Promise<void>;
}

const clampPositiveInteger = (value: number): number => {
    return Math.max(1, Math.floor(value));
};

const normalizeParallelism = (
    mpiRanks: number,
    openmpThreads: number,
    maxCpus: number | null
): {
    mpiRanks: number;
    openmpThreads: number;
} => {
    const normalizedMpiRanks = clampPositiveInteger(mpiRanks);
    const normalizedOpenmpThreads = clampPositiveInteger(openmpThreads);

    if (typeof maxCpus !== 'number' || !Number.isFinite(maxCpus) || maxCpus < 1) {
        return {
            mpiRanks: normalizedMpiRanks,
            openmpThreads: normalizedOpenmpThreads
        };
    }

    const resolvedMaxCpus = clampPositiveInteger(maxCpus);
    const clampedMpiRanks = Math.min(normalizedMpiRanks, resolvedMaxCpus);
    const maxOpenmpThreads = Math.max(1, Math.floor(resolvedMaxCpus / clampedMpiRanks));

    return {
        mpiRanks: clampedMpiRanks,
        openmpThreads: Math.min(normalizedOpenmpThreads, maxOpenmpThreads)
    };
};

const LammpsPerformanceModal = ({
    id,
    mpiRanks,
    openmpThreads,
    maxCpus,
    clusterName,
    isLoadingLimits,
    isSubmitting,
    onSubmit
}: LammpsPerformanceModalProps) => {
    const initialConfig = useMemo(() => normalizeParallelism(mpiRanks, openmpThreads, maxCpus), [
        mpiRanks,
        openmpThreads,
        maxCpus
    ]);
    const [localMpiRanks, setLocalMpiRanks] = useState(initialConfig.mpiRanks);
    const [localOpenmpThreads, setLocalOpenmpThreads] = useState(initialConfig.openmpThreads);
    const [error, setError] = useState<string | undefined>();

    const resolvedMaxCpus = useMemo(() => {
        if (typeof maxCpus !== 'number' || !Number.isFinite(maxCpus) || maxCpus < 1) {
            return null;
        }

        return clampPositiveInteger(maxCpus);
    }, [maxCpus]);

    const maxOpenmpThreads = useMemo(() => {
        if (!resolvedMaxCpus) {
            return null;
        }

        return Math.max(1, Math.floor(resolvedMaxCpus / localMpiRanks));
    }, [localMpiRanks, resolvedMaxCpus]);
    const totalCpuDemand = localMpiRanks * localOpenmpThreads;

    useEffect(() => {
        const nextConfig = normalizeParallelism(mpiRanks, openmpThreads, resolvedMaxCpus);
        setLocalMpiRanks(nextConfig.mpiRanks);
        setLocalOpenmpThreads(nextConfig.openmpThreads);
    }, [mpiRanks, openmpThreads, resolvedMaxCpus]);

    const resetState = useCallback(() => {
        const nextConfig = normalizeParallelism(mpiRanks, openmpThreads, resolvedMaxCpus);
        setLocalMpiRanks(nextConfig.mpiRanks);
        setLocalOpenmpThreads(nextConfig.openmpThreads);
        setError(undefined);
    }, [mpiRanks, openmpThreads, resolvedMaxCpus]);

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const handleSubmit = useCallback(async () => {
        if (!resolvedMaxCpus) {
            setError('Cluster metrics are unavailable, so MPI and OpenMP cannot be adjusted yet.');
            return;
        }

        setError(undefined);

        try {
            await onSubmit(normalizeParallelism(localMpiRanks, localOpenmpThreads, resolvedMaxCpus));
            handleRequestClose();
        } catch (nextError) {
            const userError = reportError(nextError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to update performance'
            });
            setError(userError.description ?? userError.title);
        }
    }, [handleRequestClose, localMpiRanks, localOpenmpThreads, onSubmit, resolvedMaxCpus]);

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleRequestClose,
        disabled: isSubmitting
    };

    const primaryAction: ModalFooterAction = {
        label: 'Save',
        onClick: () => {
            void handleSubmit();
        },
        disabled: isSubmitting || isLoadingLimits || !resolvedMaxCpus,
        isLoading: isSubmitting
    };

    return (
        <Modal
            id={id}
            title='Performance'
            description='Adjust the hybrid MPI and OpenMP parallelism stored on this script.'
            onClose={resetState}
            width='34rem'
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Container className='d-flex column gap-1 p-1-5'>
                <SettingsSectionHeader
                    title='Threads'
                    description={clusterName
                        ? `Available cores are resolved from the ${clusterName} cluster.`
                        : 'Available cores are resolved from the cluster attached to this script.'}
                    className='pb-05'
                    headingAs='h3'
                />

                {isLoadingLimits ? (
                    <Paragraph className='font-size-2 color-muted'>
                        Loading cluster capacity...
                    </Paragraph>
                ) : !resolvedMaxCpus ? (
                    <Paragraph className='font-size-2 color-muted'>
                        Cluster metrics are not available yet. MPI and OpenMP can be configured after the next cluster heartbeat.
                    </Paragraph>
                ) : (
                    <>
                        <Container
                            className='d-flex column gap-075 p-1'
                            style={{
                                border: '1px solid var(--color-border-primary)',
                                borderRadius: '0.9rem'
                            }}
                        >
                            <Container className='d-flex items-center content-between gap-1'>
                                <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                    <Cpu size={16} />
                                    MPI ranks
                                </span>
                                <span className='font-size-2 font-weight-6 color-primary'>
                                    {localMpiRanks}
                                </span>
                            </Container>

                            <Slider
                                min={1}
                                max={resolvedMaxCpus}
                                step={1}
                                value={localMpiRanks}
                                onChange={(value) => {
                                    const normalizedMpiRanks = Math.min(clampPositiveInteger(value), resolvedMaxCpus);
                                    const nextMaxOpenmpThreads = Math.max(1, Math.floor(resolvedMaxCpus / normalizedMpiRanks));
                                    setLocalMpiRanks(normalizedMpiRanks);
                                    setLocalOpenmpThreads((currentValue) => Math.min(currentValue, nextMaxOpenmpThreads));
                                    setError(undefined);
                                }}
                                disabled={isSubmitting}
                            />

                            <Container className='d-flex content-between font-size-1 color-muted'>
                                <span>1</span>
                                <span>{resolvedMaxCpus}</span>
                            </Container>
                        </Container>

                        <Container
                            className='d-flex column gap-075 p-1'
                            style={{
                                border: '1px solid var(--color-border-primary)',
                                borderRadius: '0.9rem'
                            }}
                        >
                            <Container className='d-flex items-center content-between gap-1'>
                                <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                    <Cpu size={16} />
                                    OpenMP threads
                                </span>
                                <span className='font-size-2 font-weight-6 color-primary'>
                                    {localOpenmpThreads}
                                </span>
                            </Container>

                            <Slider
                                min={1}
                                max={maxOpenmpThreads ?? 1}
                                step={1}
                                value={localOpenmpThreads}
                                onChange={(value) => {
                                    setLocalOpenmpThreads(
                                        Math.min(clampPositiveInteger(value), maxOpenmpThreads ?? 1)
                                    );
                                    setError(undefined);
                                }}
                                disabled={isSubmitting}
                            />

                            <Container className='d-flex content-between font-size-1 color-muted'>
                                <span>1</span>
                                <span>{maxOpenmpThreads ?? 1}</span>
                            </Container>
                        </Container>
                    </>
                )}

                <Paragraph className='font-size-1 color-muted'>
                    Total CPU demand: {totalCpuDemand}
                    {resolvedMaxCpus ? ` / ${resolvedMaxCpus}` : ''}. Future runs use hybrid parallelism as MPI ranks x OpenMP threads.
                </Paragraph>

                {error && (
                    <Paragraph className='font-size-2' style={{ color: 'var(--color-danger-500)' }}>
                        {error}
                    </Paragraph>
                )}
            </Container>
        </Modal>
    );
};

export default LammpsPerformanceModal;
