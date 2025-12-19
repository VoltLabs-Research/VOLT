import { useEffect, useCallback, memo } from 'react';
import SimulationCard from '@/components/atoms/trajectory/SimulationCard';
import SimulationSkeletonCard from '@/components/atoms/trajectory/SimulationSkeletonCard';
import useTrajectoryStore from '@/stores/trajectories';
import useAnimationPresence from '@/hooks/ui/animation/use-animation-presence';
import EmptyState from '@/components/atoms/common/EmptyState';
import Container from '@/components/primitives/Container';
import './SimulationGrid.css';
    
const SimulationGrid = memo(() => {
    const [parent] = useAnimationPresence();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const selectedTrajectories = useTrajectoryStore((state) => state.selectedTrajectories);
    const deleteSelectedTrajectories = useTrajectoryStore((state) => state.deleteSelectedTrajectories);
    const toggleTrajectorySelectionStore = useTrajectoryStore((state) => state.toggleTrajectorySelection);

    const toggleTrajectorySelection = useCallback((id: string) => {
        toggleTrajectorySelectionStore(id);
    }, [toggleTrajectorySelectionStore]);
    const isLoading = useTrajectoryStore((state) => state.isLoadingTrajectories);
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    const hasActiveUploads = Object.keys(activeUploads).length > 0;
    const hasEmptyState = !isLoading && trajectories.length === 0 && !hasActiveUploads;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if(selectedTrajectories.length === 0){
                return;
            }

            const isDeleteShortcut = (event.ctrlKey || event.metaKey) && (event.key === 'Backspace' || event.key === 'Delete');
            if(isDeleteShortcut){
                event.preventDefault();
                deleteSelectedTrajectories();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedTrajectories.length, deleteSelectedTrajectories]);

    if(hasEmptyState){
        return <EmptyState
            title='No Trajectories Yet'
            description='Get started by uploading your first simulation trajectory file to visualize and analyze atomic structures.' />
    }

    if(isLoading){
        return (
            <Container className='trajectories-container gap-1-5 w-max y-auto'>
                <SimulationSkeletonCard n={8} />
            </Container>
        )
    }
    return (
        <Container className='trajectories-container gap-1-5 w-max y-auto' ref={parent as React.RefObject<HTMLDivElement | null>}>
            {Object.values(activeUploads).map((upload) => (
                <SimulationSkeletonCard
                    key={upload.id}
                    progress={upload.status === 'processing' ? upload.processingProgress : upload.uploadProgress}
                    status={upload.status}
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
