import { useShallow } from 'zustand/react/shallow';
import { useShallow } from 'zustand/react/shallow';
import usePropertySelector from '@/modules/trajectory/presentation/hooks/particle-filter/use-property-selector';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import useCanvasUrlState from '@/modules/canvas/presentation/hooks/use-canvas-url-state';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';

export interface UseModifierBaseOptions {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

/**
 * Base hook for modifier-related features (color coding, particle filter, etc.)
 * Provides common trajectory/analysis resolution and property selection.
 */
const useModifierBase = (options: UseModifierBaseOptions = {}) => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const { analysisId: urlAnalysisId } = useCanvasUrlState();
    
    const analysisId = options.analysisId || urlAnalysisId || undefined;
    
    const { currentTimestep, setActiveScene } = useEditorStore(useShallow((state) => ({
        currentTimestep: options.currentTimestep ?? state.currentTimestep,
        setActiveScene: state.setActiveScene
    })));

    const effectiveTrajectoryId = options.trajectoryId || trajectory?._id;

    const propertySelector = usePropertySelector({
        trajectoryId: effectiveTrajectoryId,
        analysisId,
        timestep: currentTimestep
    });

    return {
        // Resolved IDs
        trajectoryId: effectiveTrajectoryId,
        analysisId,
        currentTimestep,
        
        // Property selector (spread to maintain API)
        ...propertySelector,
        
        // Editor actions
        setActiveScene
    };
};

export default useModifierBase;
