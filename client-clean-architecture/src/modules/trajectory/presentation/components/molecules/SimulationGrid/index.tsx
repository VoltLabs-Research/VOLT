import { useEffect, useCallback, memo } from 'react';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import SimulationCard from '../../atoms/SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import { useTrajectoryStore } from '@/modules/trajectory/presentation/stores';
import { useTrajectories } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import useAnimationPresence from '@/shared/presentation/hooks/ui/animation/use-animation-presence';
import EmptyState from '@/shared/presentation/components/atoms/common/EmptyState';
import Container from '@/shared/presentation/components/primitives/Container';
import './SimulationGrid.css';

const SimulationGrid = memo(() => {
    const { confirm } = useConfirm();
    const [parent] = useAnimationPresence();
    const searchQuery = useUIStore((s) => s.query);

    const { 
        trajectories, 
        isLoading, 
    } = useTrajectories({ search: searchQuery });

    const selectedTrajectories = useTrajectoryStore((state) => state.selectedTrajectories);
    // const deleteSelectedTrajectories = useTrajectoryStore((state) => state.deleteSelectedTrajectories); // TODO: Implement in store if needed for multiple
    const toggleTrajectorySelectionStore = useTrajectoryStore((state) => state.toggleTrajectorySelection);

    const toggleTrajectorySelection = useCallback((id: string) => {
        toggleTrajectorySelectionStore(id);
    }, [toggleTrajectorySelectionStore]);
    
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    const activeUploadEntries = Object.entries(activeUploads);
    const hasEmptyState = !isLoading && trajectories.length === 0 && activeUploadEntries.length === 0;

    useEffect(() => {
        const handleKeyDown = async (event: KeyboardEvent) => {
            if (selectedTrajectories.length === 0) {
                return;
            }

            const isDeleteShortcut = (event.ctrlKey || event.metaKey) && (event.key === 'Backspace' || event.key === 'Delete');
            if (isDeleteShortcut) {
                event.preventDefault();
                if (await confirm(`Delete ${selectedTrajectories.length} selected trajectories? This cannot be undone.`)) {
                    // deleteSelectedTrajectories();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedTrajectories.length, confirm]); // deleteSelectedTrajectories

    if (hasEmptyState) {
        return <EmptyState
            title='No Trajectories Yet'
            description='Get started by uploading your first simulation trajectory file to visualize and analyze atomic structures.' />
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
