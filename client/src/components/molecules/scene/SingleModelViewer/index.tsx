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

import { computeGlbUrl } from '@/utilities/glb/scene-utils';

import { useEditorStore } from '@/stores/slices/editor';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';

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

    const teamId = useTeamStore(state => state.selectedTeam?._id);

    const url = useMemo(() =>
        // @ts-ignore
        computeGlbUrl(teamId || '', trajectoryId, currentTimestep, analysisId, sceneConfig),
        [teamId, trajectoryId, currentTimestep, analysisId, sceneConfig]
    );

    const handleEmptyData = React.useCallback(async () => {
        if (sceneConfig.source !== 'plugin' || !sceneConfig.exposureId) return;

        console.log('[SingleModelViewer] Empty data detected, switching exposure...');

        try {
            const exposures = await usePluginStore.getState().getRenderableExposures(trajectoryId, analysisId);

            const currentIndex = exposures.findIndex(e => e.exposureId === sceneConfig.exposureId);
            if (currentIndex === -1 || exposures.length <= 1) return;

            const nextIndex = (currentIndex + 1) % exposures.length;
            const nextExposure = exposures[nextIndex];

            console.log(`[SingleModelViewer] Switching from ${sceneConfig.exposureId} to ${nextExposure.exposureId}`);

            const newScene = {
                ...sceneConfig,
                exposureId: nextExposure.exposureId,
                analysisId: nextExposure.analysisId, 
                sceneType: 'plugin',
                source: 'plugin'
            };

            const editorStore = useEditorStore.getState();
            editorStore.removeScene(sceneConfig as any);
            editorStore.addScene(newScene as any);

            if (editorStore.activeScene && (editorStore.activeScene as any).exposureId === sceneConfig.exposureId) {
                editorStore.setActiveScene(newScene as any);
            }

        } catch (err) {
            console.error('[SingleModelViewer] Failed to switch exposure', err);
        }
    }, [sceneConfig, trajectoryId, analysisId]);

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
        orbitControlsRef,
        onEmptyData: handleEmptyData
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
