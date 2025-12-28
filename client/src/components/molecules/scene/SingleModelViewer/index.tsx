import React, { useMemo } from 'react';
import CameraManager from '@/components/atoms/scene/CameraManager';
import useSlicingPlanes from '@/hooks/canvas/use-slicing-planes';
import useGlbScene from '@/hooks/canvas/use-glb-scene';
import { useTeamStore } from '@/stores/slices/team';

interface SingleModelViewerProps {
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId?: string;
    sceneConfig: {
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
    isPrimary?: boolean; // Determines if this model drives the camera/autofit
    onModelLoaded?: (bounds: any) => void;
    onSelect?: () => void;
    isSelected?: boolean;
}

const computeGlbUrl = (
    trajectoryId: string,
    currentTimestep: number | undefined,
    analysisId: string,
    activeScene?: SingleModelViewerProps['sceneConfig']
): string | null => {
    if (!trajectoryId || currentTimestep === undefined) return null;

    if (activeScene?.source === 'plugin') {
        const { analysisId: sceneAnalysisId, exposureId } = activeScene;
        if (!sceneAnalysisId || !exposureId) return null;
        return `/plugins/glb/${trajectoryId}/${sceneAnalysisId}/${exposureId}/${currentTimestep}`;
    }

    if (activeScene?.source === 'color-coding') {
        const { property, startValue, endValue, gradient, analysisId: sceneAnalysisId, exposureId } = activeScene;
        let url = `/color-coding/${trajectoryId}/${sceneAnalysisId}/?property=${property}&startValue=${startValue}&endValue=${endValue}&gradient=${gradient}&timestep=${currentTimestep}`;
        if (exposureId) url += `&exposureId=${exposureId}`;
        return url;
    }

    return `/trajectories/${useTeamStore.getState().selectedTeam?._id}/${trajectoryId}/${currentTimestep}/${analysisId}`;
};

const SingleModelViewer: React.FC<SingleModelViewerProps> = ({
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
    sceneConfig,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing = true,
    updateThrottle = 16,
    isPrimary = false,
    onModelLoaded,
    onSelect,
    isSelected = false
}) => {
    const sliceClippingPlanes = useSlicingPlanes(enableSlice);

    const url = useMemo(() =>
        computeGlbUrl(trajectoryId, currentTimestep, analysisId, sceneConfig),
        [trajectoryId, currentTimestep, analysisId, sceneConfig]
    );

    const { modelBounds, deselect } = useGlbScene({
        url,
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
        onSelect,
        orbitControlsRef
    });

    React.useEffect(() => {
        if (!isSelected) {
            deselect();
        }
    }, [isSelected, deselect]);

    React.useEffect(() => {
        if (modelBounds && onModelLoaded) {
            onModelLoaded(modelBounds);
        }
    }, [modelBounds, onModelLoaded]);

    const shouldRenderCamera = useMemo(() =>
        isPrimary && autoFit && modelBounds,
        [isPrimary, autoFit, modelBounds]
    );

    if (!shouldRenderCamera) return null;

    return (
        <CameraManager
            modelBounds={modelBounds || undefined}
            orbitControlsRef={orbitControlsRef}
            face='ny'
        />
    );
};

export default React.memo(SingleModelViewer);
