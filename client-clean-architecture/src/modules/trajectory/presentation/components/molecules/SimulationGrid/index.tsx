import { memo, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useDeleteSelectedTrajectories from '../../../hooks/trajectory/use-delete-selected-trajectories';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import './SimulationGrid.css';

const SimulationGrid = memo(() => {
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const selectedIds = useTrajectoryStore((state) => state.selectedIds);
    const isLoading = useTrajectoryStore((state) => state.isLoadingList);
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    const toggleSelection = useTrajectoryStore((state) => state.toggleSelection);

    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();

    const activeUploadEntries = Object.entries(activeUploads);
    const isEmpty = !isLoading && trajectories.length === 0 && activeUploadEntries.length === 0;

    // Keyboard shortcut for bulk delete
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if(selectedIds.length === 0) return;
            
            const isDeleteShortcut = (e.ctrlKey || e.metaKey) && (e.key === 'Backspace' || e.key === 'Delete');
            if(isDeleteShortcut){
                e.preventDefault();
                await deleteSelectedTrajectories();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds.length, deleteSelectedTrajectories]);

    const handleDownloadSamples = useCallback(() => {
        // TODO: Implement via use case
        console.log('Download samples');
    }, []);

    if(isEmpty){
        return (
            <EmptyState
                icon={<Download size={24} strokeWidth={1.5} />}
                title='No simulations yet'
                description='Upload a trajectory file or download samples to get started'
                buttonText='Download Samples'
                buttonOnClick={handleDownloadSamples}
            />
        );
    }

    if(isLoading){
        return (
            <Container className='trajectories-grid gap-1-5 w-max y-auto'>
                <SimulationSkeletonCard />
            </Container>
        );
    }

    return (
        <Container className='trajectories-grid gap-1-5 w-max y-auto'>
            {activeUploadEntries.map(([id, progress]) => (
                <SimulationSkeletonCard key={id} uploadProgress={progress} />
            ))}
            {trajectories.map((trajectory) => (
                <SimulationCard
                    key={trajectory._id}
                    trajectory={trajectory}
                    isSelected={selectedIds.includes(trajectory._id)}
                    onSelect={toggleSelection}
                />
            ))}
        </Container>
    );
});

SimulationGrid.displayName = 'SimulationGrid';

export default SimulationGrid;
