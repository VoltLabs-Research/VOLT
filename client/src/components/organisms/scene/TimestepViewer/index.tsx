import React, { useMemo, forwardRef, useImperativeHandle } from 'react';
import CameraManager from '@/components/atoms/scene/CameraManager';
import useSlicingPlanes from '@/hooks/canvas/use-slicing-planes';
import useGlbScene from '@/hooks/canvas/use-glb-scene';
import { createTrajectoryGLBs } from '@/utilities/glb/modelUtils';
import useModelStore from '@/stores/editor/model';

interface TimestepViewerProps {
    /** Trajectory ID - required for computing GLB URL */
    trajectoryId: string;
    /** Current timestep - required for computing GLB URL */
    currentTimestep: number | undefined;
    /** Analysis config ID - defaults to 'default' */
    analysisId?: string;
    /** Active scene configuration from store */
    activeScene?: {
        sceneType: string;
        source: string;
        analysisId?: string;
        exposureId?: string;
        property?: string;
        startValue?: number;
        endValue?: number;
        gradient?: string;
    };
    rotation?: { x?: number; y?: number; z?: number };
    position?: { x?: number; y?: number; z?: number };
    scale?: number;
    autoFit?: boolean;
    orbitControlsRef?: React.RefObject<any>;
    enableSlice?: boolean;
    enableInstancing?: boolean;
    updateThrottle?: number;
}

export interface TimestepViewerRef {
    loadModel: () => void;
}

/**
 * Compute the GLB URL based on scene configuration.
 * This is the SINGLE SOURCE OF TRUTH for URL - no global store involved.
 */
const computeGlbUrl = (
    trajectoryId: string,
    currentTimestep: number | undefined,
    analysisId: string,
    activeScene?: TimestepViewerProps['activeScene']
): string | null => {
    if(!trajectoryId || currentTimestep === undefined) return null;

    // Handle different scene sources
    if(activeScene?.source === 'plugin'){
        const { analysisId: sceneAnalysisId, exposureId } = activeScene;
        if(!sceneAnalysisId || !exposureId) return null;
        return `/plugins/glb/${trajectoryId}/${sceneAnalysisId}/${exposureId}/${currentTimestep}`;
    }

    if(activeScene?.source === 'color-coding'){
        const { property, startValue, endValue, gradient, analysisId: sceneAnalysisId, exposureId } = activeScene;
        let url = `/color-coding/${trajectoryId}/${sceneAnalysisId}/?property=${property}&startValue=${startValue}&endValue=${endValue}&gradient=${gradient}&timestep=${currentTimestep}`;
        if(exposureId) url += `&exposureId=${exposureId}`;
        return url;
    }

    // Default: use trajectory GLB
    const glbs = createTrajectoryGLBs(trajectoryId, currentTimestep, analysisId || 'default');
    return glbs[activeScene?.sceneType as keyof typeof glbs] || glbs.trajectory;
};

const TimestepViewer = forwardRef<TimestepViewerRef, TimestepViewerProps>(({
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
    activeScene,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing = true,
    updateThrottle = 16,
}, ref) => {
    const sliceClippingPlanes = useSlicingPlanes(enableSlice);

    // Compute URL LOCALLY - this is the key change!
    // URL is derived from props, NOT from global stores
    const url = useMemo(() =>
        computeGlbUrl(trajectoryId, currentTimestep, analysisId, activeScene),
        [trajectoryId, currentTimestep, analysisId, activeScene]
    );

    // Use useGlbScene with the computed URL
    const { modelBounds, resetModel } = useGlbScene({
        url,  // Pass URL directly - overrides store-derived URL
        sliceClippingPlanes,
        position: {
            x: position.x || 0,
            y: position.y || 0,
            z: position.z || 0
        },
        rotation: {
            x: rotation.x || 0,
            y: rotation.y || 0,
            z: rotation.z || 0
        },
        scale,
        enableInstancing,
        updateThrottle,
    });

    useImperativeHandle(ref, () => ({
        loadModel: () => {
            resetModel();
        }
    }), [resetModel]);

    const shouldRenderCamera = useMemo(() =>
        autoFit && modelBounds,
        [autoFit, modelBounds]
    );

    if(!shouldRenderCamera) return null;

    return (
        <CameraManager
            modelBounds={modelBounds || undefined}
            orbitControlsRef={orbitControlsRef}
            face='ny'
        />
    );
});

TimestepViewer.displayName = 'TimestepViewer';

export default TimestepViewer;
