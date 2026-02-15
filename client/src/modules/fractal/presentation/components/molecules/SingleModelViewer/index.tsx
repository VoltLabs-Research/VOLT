import React, { useMemo } from 'react';
import useSlicingPlanes from '@/modules/fractal/presentation/hooks/use-slicing-planes';
import useGlbScene from '@/modules/fractal/presentation/hooks/use-glb-scene';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import SimulationCellBox from '@/modules/fractal/presentation/components/molecules/SimulationCellBox';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { buildCellBoxTransforms, calculateBoxTransforms, getGroundOffset, getTrajectoryBoxBounds } from '@/modules/fractal/presentation/utilities/boxUtils';
import { getSceneKey, normalizeVec3 } from '@/modules/fractal/presentation/utilities/sceneUtils';
import { computeGlbUrl, type ActiveScene } from '@/modules/fractal/core/glb-url';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/presentation/types/configuration';

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
    slicePlaneConfig: SlicePlaneConfig;
    pointSizeMultiplier: number;
    sceneOpacities: Record<string, number>;
    activeModelBounds?: any;
    onModelBoundsChanged?: (bounds: any) => void;
    onLoadingStateChanged?: (isLoading: boolean) => void;
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
    slicePlaneConfig,
    pointSizeMultiplier,
    sceneOpacities,
    activeModelBounds,
    onModelBoundsChanged,
    onLoadingStateChanged,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit: _autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing = true,
    updateThrottle = 16,
    isPrimary: _isPrimary = false,
    onModelLoaded,
    onSelect,
    isSelected = false
}) => {
    const teamId = useTeamStore(state => state.selectedTeam?._id);
    const setModelWorldBounds = useEditorStore(state => state.setModelWorldBounds);

    const trajectory = useTrajectoryStore(state => state.trajectory);
    const boxBounds = useMemo(() => {
        return getTrajectoryBoxBounds(trajectory, currentTimestep);
    }, [trajectory, currentTimestep]);

    const boxTransforms = useMemo(() => {
        if (!boxBounds) return { scale: 1, position: { x: 0, y: 0, z: 0 }, maxDimension: 1, center: { x: 0, y: 0, z: 0 } };
        return calculateBoxTransforms(boxBounds as any);
    }, [boxBounds]);

    const groundOffset = useMemo(() => getGroundOffset(boxBounds, boxTransforms), [boxBounds, boxTransforms]);
    const cellBoxTransforms = useMemo(() => buildCellBoxTransforms(boxTransforms, groundOffset), [boxTransforms, groundOffset]);

    const modelWorldBounds = useMemo<ModelWorldBounds>(() => {
        if (boxBounds && cellBoxTransforms) {
            const s = cellBoxTransforms.scale;
            const gz = cellBoxTransforms.groundOffset || 0;
            return {
                min: { x: boxBounds.xlo * s, y: boxBounds.ylo * s, z: boxBounds.zlo * s + gz },
                max: { x: boxBounds.xhi * s, y: boxBounds.yhi * s, z: boxBounds.zhi * s + gz }
            };
        }
        return { min: { x: -4, y: -4, z: -4 }, max: { x: 4, y: 4, z: 4 } };
    }, [boxBounds, cellBoxTransforms]);

    React.useEffect(() => {
        setModelWorldBounds(modelWorldBounds);
    }, [modelWorldBounds, setModelWorldBounds]);

    const sliceClippingPlanes = useSlicingPlanes(enableSlice, slicePlaneConfig, modelWorldBounds);

    const url = useMemo(() =>
        computeGlbUrl({
            teamId: teamId || '',
            trajectoryId,
            currentTimestep,
            analysisId,
            activeScene: sceneConfig as ActiveScene
        }),
        [teamId, trajectoryId, currentTimestep, analysisId, sceneConfig]
    );

    const handleEmptyData = React.useCallback(async () => {
        return;
    }, []);

    const sceneKey = useMemo(() => getSceneKey(sceneConfig), [sceneConfig]);

    const { modelBounds, deselect, model, setSimBoxMesh } = useGlbScene({
        url,
        sliceClippingPlanes,
        position: normalizeVec3(position),
        rotation: normalizeVec3(rotation),
        scale,
        enableInstancing,
        updateThrottle,
        onSelect,
        orbitControlsRef,
        onEmptyData: handleEmptyData,
        disableAutoTransform: Boolean(boxBounds),
        sceneKey,
        boxBounds,
        normalizationScale: cellBoxTransforms?.scale,
        pointSizeMultiplier,
        sceneOpacities,
        activeModelBounds,
        onModelBoundsChanged,
        onLoadingStateChanged
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

    return (
        <SimulationCellBox
            ref={setSimBoxMesh}
            boxBounds={boxBounds}
            transforms={cellBoxTransforms}
        >
            {model && <primitive object={model} />}
        </SimulationCellBox>
    );
};

export default SingleModelViewer;
