import React, { useMemo } from 'react';
import CameraManager from '@/modules/canvas/presentation/components/atoms/CameraManager';
import useSlicingPlanes from '@/modules/canvas/presentation/hooks/use-slicing-planes';
import useGlbScene from '@/modules/canvas/presentation/hooks/use-glb-scene';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import SimulationCellBox from '@/modules/canvas/presentation/components/molecules/SimulationCellBox';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { calculateBoxTransforms } from '@/modules/canvas/presentation/utilities/boxUtils';
import { computeGlbUrl } from '@/modules/canvas/presentation/utilities/scene-utils';

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
    isPrimary?: boolean;
    onModelLoaded?: (bounds: any) => void;
    onSelect?: () => void;
    isSelected?: boolean;
}

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
        computeGlbUrl(teamId || '', trajectoryId, currentTimestep, analysisId, sceneConfig),
        [teamId, trajectoryId, currentTimestep, analysisId, sceneConfig]
    );

    const handleEmptyData = React.useCallback(async () => {
        return;
    }, []);

    const trajectory = useTrajectoryStore(state => state.trajectory);
    const boxBounds = useMemo(() => {
        if (!trajectory || currentTimestep === undefined) return undefined;
        let frame = trajectory.frames?.find((f: any) => f.timestep === currentTimestep);

        if (!frame?.simulationCell) {
            frame = trajectory.frames?.find((f: any) => f.simulationCell);
        }

        if (frame?.simulationCell) {
            const { geometry, boundingBox } = frame.simulationCell as any;
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

    const boxTransforms = useMemo(() => {
        if (!boxBounds) return { scale: 1, position: { x: 0, y: 0, z: 0 }, maxDimension: 1, center: { x: 0, y: 0, z: 0 } };
        return calculateBoxTransforms(boxBounds as any);
    }, [boxBounds]);

    const sceneKey = useMemo(() => {
        if (sceneConfig.source === 'plugin') {
            return `plugin-${sceneConfig.analysisId}-${sceneConfig.exposureId}`;
        }
        return `${sceneConfig.source}-${sceneConfig.sceneType}`;
    }, [sceneConfig]);

    const groundOffset = useMemo(() => {
        if (!boxBounds || !boxTransforms) return 0;
        const minZWorld = (boxBounds.zlo * boxTransforms.scale) + boxTransforms.position.z;
        return -minZWorld;
    }, [boxBounds, boxTransforms]);

    const cellBoxTransforms = useMemo(() => {
        if (!boxTransforms) return undefined;
        return {
            scale: boxTransforms.scale,
            position: {
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
