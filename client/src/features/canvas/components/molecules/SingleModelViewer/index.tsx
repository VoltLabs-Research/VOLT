import React, { useMemo } from 'react';
import CameraManager from '@/features/canvas/components/atoms/CameraManager';
import useSlicingPlanes from '@/features/canvas/hooks/use-slicing-planes';
import useGlbScene from '@/features/canvas/hooks/use-glb-scene';
import { useTeamStore } from '@/features/team/stores';
import SimulationCellBox from '@/features/canvas/components/molecules/SimulationCellBox';
import { useTrajectoryStore } from '@/features/trajectory/stores';
import { calculateBoxTransforms } from '@/features/canvas/utilities/boxUtils';

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

import { computeGlbUrl } from '@/features/canvas/utilities/scene-utils';

import { useEditorStore } from '@/features/canvas/stores/editor';
import { usePluginStore } from '@/features/plugins/stores/plugin-slice';

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

        try {
            const exposures = await usePluginStore.getState().getRenderableExposures(trajectoryId, analysisId);

            const currentIndex = exposures.findIndex(e => e.exposureId === sceneConfig.exposureId);
            if (currentIndex === -1 || exposures.length <= 1) return;

            const nextIndex = (currentIndex + 1) % exposures.length;
            const nextExposure = exposures[nextIndex];

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

    // Get box bounds from store
    const trajectory = useTrajectoryStore(state => state.trajectory);
    const boxBounds = useMemo(() => {
        if (!trajectory || currentTimestep === undefined) return undefined;
        let frame = trajectory.frames?.find(f => f.timestep === currentTimestep);

        if (!frame?.simulationCell) {
            frame = trajectory.frames?.find(f => f.simulationCell);
        }

        if (frame?.simulationCell) {
            // @ts-ignore
            const { geometry, boundingBox } = frame.simulationCell;
            if (geometry?.cell_origin && boundingBox) {
                const [xlo, ylo, zlo] = geometry.cell_origin;
                return {
                    xlo,
                    xhi: xlo + boundingBox.width,
                    ylo,
                    yhi: ylo + boundingBox.length,
                    zlo,
                    zhi: zlo + boundingBox.height
                };
            }
        }

        return frame?.boxBounds;
    }, [trajectory, currentTimestep]);

    // Calcular transformaciones desde boxBounds
    const boxTransforms = useMemo(() => {
        if (!boxBounds) return { scale: 1, position: { x: 0, y: 0, z: 0 }, maxDimension: 1, center: { x: 0, y: 0, z: 0 } };
        return calculateBoxTransforms(boxBounds);
    }, [boxBounds]);

    // Compute scene key for per-scene settings like opacity
    const sceneKey = useMemo(() => {
        if (sceneConfig.source === 'plugin') {
            return `plugin-${sceneConfig.analysisId}-${sceneConfig.exposureId}`;
        }
        return `${sceneConfig.source}-${sceneConfig.sceneType}`;
    }, [sceneConfig]);

    // Calcular groundOffset desde boxBounds transformados
    const groundOffset = useMemo(() => {
        if (!boxBounds || !boxTransforms) return 0;
        // Calcular el z mínimo del box en coordenadas mundiales
        const minZWorld = (boxBounds.zlo * boxTransforms.scale) + boxTransforms.position.z;
        // El offset necesario para que toque z=0
        return -minZWorld;
    }, [boxBounds, boxTransforms]);

    // Combinar transforms con groundOffset y la posición de la escena
    const cellBoxTransforms = useMemo(() => {
        if (!boxTransforms) return undefined;
        return {
            scale: boxTransforms.scale,
            position: {
                // x: boxTransforms.position.x + (position.x || 0),
                // y: boxTransforms.position.y + (position.y || 0),
                // z: boxTransforms.position.z + (position.z || 0)
                x: 0,
                y: 0,
                z: 0
            },
            groundOffset
        };
    }, [boxTransforms, groundOffset, position]);

    const { modelBounds, deselect, model, setSimBoxMesh } = useGlbScene({
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
        onEmptyData: handleEmptyData,
        disableAutoTransform: true,
        sceneKey,
        boxBounds,
        normalizationScale: cellBoxTransforms?.scale
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

    return (
        <>
            <SimulationCellBox
                ref={setSimBoxMesh}
                boxBounds={boxBounds}
                transforms={cellBoxTransforms}
            >
                {model && <primitive object={model} />}
            </SimulationCellBox>

            {shouldRenderCamera && (
                <CameraManager
                    modelBounds={modelBounds || undefined}
                    orbitControlsRef={orbitControlsRef}
                    face='ny'
                />
            )}
        </>
    );
};

export default React.memo(SingleModelViewer);
