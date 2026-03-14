import useSlicingPlanes from '@/modules/fractal/hooks/use-slicing-planes';
import useGlbScene from '@/modules/fractal/hooks/use-glb-scene';
import SimulationCellBox from '@/modules/fractal/components/molecules/SimulationCellBox';
import { areModelWorldBoundsEqual } from '@/modules/fractal/utilities/model-world-bounds';
import { buildCellBoxTransforms, calculateBoxTransforms, getGroundOffset } from '@/modules/fractal/utilities/box-utils';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { computeGlbUrl } from '@/modules/fractal/api/service/compute-glb-url';
import './SingleModelViewer.css';
import { useMemo, useEffect, useCallback, createElement, useRef } from 'react';
import type { BoxBounds, ModelLoadingState, OrbitControlsHandle } from '@/modules/fractal/types';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/types/configuration';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { FC, RefObject } from 'react';

interface OptionalVec3 {
    x?: number;
    y?: number;
    z?: number;
};

interface SingleModelViewerProps {
    teamId?: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId?: string;
    sceneConfig: SceneObjectType;
    slicePlaneConfig: SlicePlaneConfig;
    boxBounds: BoxBounds;
    pointSizeMultiplier: number;
    pointCloudSettings?: PointCloudSceneSettings;
    sceneOpacities: Record<string, number>;
    setModelWorldBounds?: (bounds: ModelWorldBounds | null) => void;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
    rotation?: OptionalVec3;
    position?: OptionalVec3;
    scale?: number;
    autoFit?: boolean;
    orbitControlsRef?: RefObject<OrbitControlsHandle | null>;
    enableSlice?: boolean;
    enableInstancing?: boolean;
    updateThrottle?: number;
    isPrimary?: boolean;
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onSelect?: () => void;
    isSelected?: boolean;
};

const SingleModelViewer: FC<SingleModelViewerProps> = ({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
    sceneConfig,
    slicePlaneConfig,
    boxBounds,
    pointSizeMultiplier,
    pointCloudSettings,
    sceneOpacities,
    setModelWorldBounds,
    activeModelBounds,
    onModelBoundsChanged,
    onLoadingStateChanged,
    rotation = {},
    position = {
        x: 0,
        y: 0,
        z: 0
    },
    scale = 1,
    autoFit: _autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing: _enableInstancing = true,
    updateThrottle = 16,
    isPrimary: _isPrimary = false,
    onModelLoaded,
    onSelect,
    isSelected = false
}) => {
    const lastEmittedModelWorldBoundsReference = useRef<ModelWorldBounds | null>(null);
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
            min: {
                x: boxBounds.xlo * scaleFactor,
                y: boxBounds.ylo * scaleFactor,
                z: boxBounds.zlo * scaleFactor + groundZOffset
            },
            max: {
                x: boxBounds.xhi * scaleFactor,
                y: boxBounds.yhi * scaleFactor,
                z: boxBounds.zhi * scaleFactor + groundZOffset
            }
        };
    }, [boxBounds, cellBoxTransforms]);

    useEffect(() => {
        if (areModelWorldBoundsEqual(lastEmittedModelWorldBoundsReference.current, modelWorldBounds)) {
            return;
        }

        lastEmittedModelWorldBoundsReference.current = modelWorldBounds;
        setModelWorldBounds?.(modelWorldBounds);
    }, [modelWorldBounds, setModelWorldBounds]);

    const sliceClippingPlanes = useSlicingPlanes(enableSlice, slicePlaneConfig, modelWorldBounds);

    const url = useMemo(() =>
        computeGlbUrl({
            teamId: teamId || '',
            trajectoryId,
            currentTimestep,
            analysisId,
            activeScene: sceneConfig
        }),
        [teamId, trajectoryId, currentTimestep, analysisId, sceneConfig]
    );

    const handleEmptyData = useCallback(async () => {
        return;
    }, []);

    const sceneKey = useMemo(() => getSceneKey(sceneConfig), [sceneConfig]);

    const {
        modelBounds,
        deselect,
        model,
        setSelectedObject,
        onHoverChange
    } = useGlbScene({
        url,
        sliceClippingPlanes,
        position: {
            x: position.x ?? 0,
            y: position.y ?? 0,
            z: position.z ?? 0
        },
        rotation: {
            x: rotation.x ?? 0,
            y: rotation.y ?? 0,
            z: rotation.z ?? 0
        },
        scale,
        updateThrottle,
        onSelect,
        orbitControlsRef,
        onEmptyData: handleEmptyData,
        disableAutoTransform: true,
        sceneKey,
        boxBounds,
        pointSizeMultiplier,
        pointCloudSettings,
        sceneOpacities,
        activeModelBounds,
        onModelBoundsChanged,
        onLoadingStateChanged
    });

    useEffect(() => {
        if (!isSelected) {
            deselect();
        }
    }, [isSelected, deselect]);

    useEffect(() => {
        if (modelBounds && onModelLoaded) {
            onModelLoaded(modelBounds);
        }
    }, [modelBounds, onModelLoaded]);

    return (
        <SimulationCellBox
            boxBounds={boxBounds}
            transforms={cellBoxTransforms}
            orbitControlsRef={orbitControlsRef}
            onSelect={setSelectedObject}
            onHoverChange={onHoverChange}
        >
            {model && createElement('primitive', { object: model })}
        </SimulationCellBox>
    );
};

export default SingleModelViewer;
