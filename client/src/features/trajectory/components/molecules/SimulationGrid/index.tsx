import { useEffect, useCallback, memo, useState } from 'react';
import useConfirm from '@/hooks/ui/use-confirm';
import SimulationCard from '@/features/trajectory/components/atoms/SimulationCard';
import SimulationSkeletonCard from '@/features/trajectory/components/atoms/SimulationSkeletonCard';
import { useTrajectoryStore } from '@/features/trajectory/stores';
import useAnimationPresence from '@/hooks/ui/animation/use-animation-presence';
import EmptyState from '@/components/atoms/common/EmptyState';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';
import trajectoryApi from '@/features/trajectory/api/trajectory';
import useToast from '@/hooks/ui/use-toast';
import { Download, Upload } from 'lucide-react';
import '@/features/trajectory/components/molecules/SimulationGrid/SimulationGrid.css';

const SimulationGrid = memo(() => {
    const { confirm } = useConfirm();
    const { showSuccess, showError } = useToast();
    const [parent] = useAnimationPresence();
    const [samplesDownloaded, setSamplesDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const selectedTrajectories = useTrajectoryStore((state) => state.selectedTrajectories);
    const deleteSelectedTrajectories = useTrajectoryStore((state) => state.deleteSelectedTrajectories);
    const toggleTrajectorySelectionStore = useTrajectoryStore((state) => state.toggleTrajectorySelection);

    const toggleTrajectorySelection = useCallback((id: string) => {
        toggleTrajectorySelectionStore(id);
    }, [toggleTrajectorySelectionStore]);
    const isLoading = useTrajectoryStore((state) => state.isLoadingTrajectories);
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    const activeUploadEntries = Object.entries(activeUploads);
    const hasEmptyState = !isLoading && trajectories.length === 0 && activeUploadEntries.length === 0;

    const handleDownloadSamples = useCallback(async () => {
        setIsDownloading(true);
        try {
            await trajectoryApi.downloadAllSamples();
            setSamplesDownloaded(true);
            showSuccess('Sample simulations downloaded successfully!');
        } catch {
            showError('Failed to download sample simulations');
        } finally {
            setIsDownloading(false);
        }
    }, [showSuccess, showError]);

    useEffect(() => {
        const handleKeyDown = async (event: KeyboardEvent) => {
            if (selectedTrajectories.length === 0) {
                return;
            }

            const isDeleteShortcut = (event.ctrlKey || event.metaKey) && (event.key === 'Backspace' || event.key === 'Delete');
            if (isDeleteShortcut) {
                event.preventDefault();
                if (await confirm(`Delete ${selectedTrajectories.length} selected trajectories? This cannot be undone.`)) {
                    deleteSelectedTrajectories();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedTrajectories.length, deleteSelectedTrajectories, confirm]);

    if (hasEmptyState) {
        if (samplesDownloaded) {
            return (
                <Container className='d-flex column items-center content-center w-max h-max'>
                    <Container className='text-center d-flex column gap-1-5 items-center' style={{ maxWidth: '320px' }}>
                        <Container 
                            className='d-flex items-center content-center' 
                            style={{ 
                                width: '56px', 
                                height: '56px', 
                                borderRadius: '16px', 
                                background: 'var(--color-zinc-800)',
                                border: '1px dashed var(--color-zinc-600)'
                            }}
                        >
                            <Upload size={24} strokeWidth={1.5} style={{ color: 'var(--color-zinc-400)' }} />
                        </Container>
                        <Container className='d-flex column gap-05 text-center'>
                            <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-zinc-100)' }}>
                                Drop your files
                            </span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-zinc-500)', lineHeight: 1.5 }}>
                                Drag any downloaded simulation here to begin
                            </span>
                        </Container>
                    </Container>
                </Container>
            );
        }

        return (
            <Container className='d-flex column items-center content-center w-max h-max'>
                <Container className='text-center d-flex column gap-1-5 items-center' style={{ maxWidth: '320px' }}>
                    <Container 
                        className='d-flex items-center content-center' 
                        style={{ 
                            width: '56px', 
                            height: '56px', 
                            borderRadius: '16px', 
                            background: 'var(--color-zinc-800)'
                        }}
                    >
                        <Download size={24} strokeWidth={1.5} style={{ color: 'var(--color-zinc-400)' }} />
                    </Container>
                    <Container className='d-flex column gap-05 text-center'>
                        <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--color-zinc-100)' }}>
                            No simulations yet
                        </span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-zinc-500)', lineHeight: 1.5 }}>
                            Upload a trajectory file or download samples to get started
                        </span>
                    </Container>
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        onClick={handleDownloadSamples}
                        isLoading={isDownloading}
                        style={{ marginTop: '0.5rem' }}
                    >
                        Download Samples
                    </Button>
                </Container>
            </Container>
        );
    }

    if (isLoading) {
        return (
            <Container className='trajectories-container gap-1-5 w-max y-auto'>
                <SimulationSkeletonCard n={8} />
            </Container>
        )
    }

    return (
        <Container className='trajectories-container gap-1-5 w-max y-auto' ref={parent as React.RefObject<HTMLDivElement | null>}>
            {activeUploadEntries.map(([id, progress]) => (
                <SimulationSkeletonCard
                    key={id}
                    progress={progress}
                    status='uploading'
                />
            ))}
            {trajectories.map((trajectory) => (
                <SimulationCard
                    key={trajectory._id}
                    trajectory={trajectory}
                    isSelected={selectedTrajectories.includes(trajectory._id)}
                    onSelect={toggleTrajectorySelection}
                />
            ))}
        </Container>
    );
});

SimulationGrid.displayName = 'SimulationGrid';

export default SimulationGrid;
