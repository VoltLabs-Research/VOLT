import React, { useMemo } from 'react';
import useSlicingPlanes from '@/modules/fractal/presentation/hooks/use-slicing-planes';
import useGlbScene from '@/modules/fractal/presentation/hooks/use-glb-scene';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import SimulationCellBox from '@/modules/fractal/presentation/components/molecules/SimulationCellBox';
import { buildCellBoxTransforms, calculateBoxTransforms, getGroundOffset } from '@/modules/fractal/presentation/utilities/boxUtils';
import { getSceneKey, normalizeVec3 } from '@/modules/fractal/presentation/utilities/sceneUtils';
import { computeGlbUrl } from '@/modules/fractal/core/glb-url';
import type { BoxBounds } from '@/modules/fractal/presentation/types';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/presentation/types/configuration';
import type { ActiveScene } from '@/modules/fractal/presentation/types/stores/editor/scene-types';

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
    boxBounds: BoxBounds;
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
    boxBounds,
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

    const boxTransforms = useMemo(() => {
        return calculateBoxTransforms(boxBounds);
    }, [boxBounds]);

    const groundOffset = useMemo(() => getGroundOffset(boxBounds, boxTransforms), [boxBounds, boxTransforms]);
    const cellBoxTransforms = useMemo(() => {
        const transforms = buildCellBoxTransforms(boxTransforms, groundOffset);

        if (!transforms) {
            throw new Error('Failed to build canonical cell box transforms.');
        }

        return transforms;
    }, [boxTransforms, groundOffset]);

    const modelWorldBounds = useMemo<ModelWorldBounds>(() => {
        const scaleFactor = cellBoxTransforms.scale;
        const groundZOffset = cellBoxTransforms.groundOffset || 0;
        return {
            min: { x: boxBounds.xlo * scaleFactor, y: boxBounds.ylo * scaleFactor, z: boxBounds.zlo * scaleFactor + groundZOffset },
            max: { x: boxBounds.xhi * scaleFactor, y: boxBounds.yhi * scaleFactor, z: boxBounds.zhi * scaleFactor + groundZOffset }
        };
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
        disableAutoTransform: true,
        sceneKey,
        boxBounds,
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
            {model && React.createElement('primitive', { object: model })}
        </SimulationCellBox>
    );
};

export default SingleModelViewer;
