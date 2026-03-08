import useCanvasSidebarScene from './use-canvas-sidebar-scene';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

interface UseCanvasSidebarStateProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
}

const useCanvasSidebarState = ({ trajectory, trajectoryId }: UseCanvasSidebarStateProps) => {
    const state = useCanvasSidebarScene({ trajectory, trajectoryId });
    const totalAnalyses = state.analyses.length;
    const showEmptySearch = !state.showSectionsSkeleton && !!state.searchQuery && state.filteredSections.length === 0;

    return {
        ...state,
        totalAnalyses,
        showEmptySearch
    };
};

export default useCanvasSidebarState;
