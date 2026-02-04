import useCanvasSidebarScene from '@/modules/canvas/presentation/hooks/use-canvas-sidebar-scene';

interface UseCanvasSidebarStateProps {
    trajectory?: any | null;
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
