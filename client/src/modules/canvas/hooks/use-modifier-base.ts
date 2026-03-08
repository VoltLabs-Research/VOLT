import { useEditorStore } from '@/modules/canvas/stores/editor';
import useCanvasUrlState from './use-canvas-url-state';

import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import usePropertySelector from '@/modules/trajectory/hooks/particle-filter/use-property-selector';

export interface UseModifierBaseOptions {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
};

const useModifierBase = (options: UseModifierBaseOptions = {}) => {
    const { trajectoryId: routeTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const { analysisId: urlAnalysisId } = useCanvasUrlState();
    
    const analysisId = options.analysisId ?? urlAnalysisId;
    
    const { currentTimestep, setActiveScene } = useEditorStore(useShallow((state) => ({
        currentTimestep: options.currentTimestep ?? state.currentTimestep,
        setActiveScene: state.setActiveScene
    })));

    const effectiveTrajectoryId = options.trajectoryId ?? routeTrajectoryId;

    const propertySelector = usePropertySelector({
        trajectoryId: effectiveTrajectoryId,
        analysisId,
        timestep: currentTimestep
    });

    return {
        trajectoryId: effectiveTrajectoryId,
        analysisId,
        currentTimestep,
        
        ...propertySelector,
        
        setActiveScene
    };
};

export default useModifierBase;
