import useSlicingPlanes from '@/modules/fractal/hooks/use-slicing-planes';
import useGlbScene from '@/modules/fractal/hooks/use-glb-scene';
import SimulationCellBox from '@/modules/fractal/components/molecules/SimulationCellBox';
import { areModelWorldBoundsEqual } from '@/modules/fractal/utilities/model-world-bounds';
import { buildCellBoxTransforms, calculateBoxTransforms, getGroundOffset } from '@/modules/fractal/utilities/box-utils';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { computeGlbUrl } from '@/modules/fractal/api/service/compute-glb-url';
import Button from '@/shared/presentation/components/Button';
import './SingleModelViewer.css';
import { Html } from '@react-three/drei';
import { useMemo, useEffect, useCallback, createElement, useRef } from 'react';
import type { BoxBounds, ModelLoadingState, OrbitControlsHandle } from '@/modules/fractal/types';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/types/configuration';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { FC, ReactNode, RefObject } from 'react';

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

interface ViewerControl {
    label: string;
    onClick: () => void;
    icon: ReactNode;
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
        resetModel,
        rotateXNegative,
        rotateXPositive,
        rotateYNegative,
        rotateYPositive,
        rotateZNegative,
        rotateZPositive,
        setSelectedObject,
        onHoverChange,
        isSelected: hasSelectedObject
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

    const controls = useMemo<ViewerControl[]>(() => {
        return [
            { label: 'Rotate X−', onClick: rotateXNegative, icon: '↕' },
            { label: 'Rotate X+', onClick: rotateXPositive, icon: '↕' },
            { label: 'Rotate Y−', onClick: rotateYNegative, icon: '↔' },
            { label: 'Rotate Y+', onClick: rotateYPositive, icon: '↔' },
            { label: 'Rotate Z−', onClick: rotateZNegative, icon: '⟲' },
            { label: 'Rotate Z+', onClick: rotateZPositive, icon: '⟳' }
        ];
    }, [
        rotateXNegative,
        rotateXPositive,
        rotateYNegative,
        rotateYPositive,
        rotateZNegative,
        rotateZPositive
    ]);

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

    const renderControl = useCallback((control: ViewerControl) => {
        return (
            <Button
                key={control.label}
                variant='outline'
                intent='neutral'
                size='sm'
                onClick={control.onClick}
                leftIcon={control.icon}
            >
                {control.label}
            </Button>
        );
    }, []);

    return (
        <SimulationCellBox
            boxBounds={boxBounds}
            transforms={cellBoxTransforms}
            orbitControlsRef={orbitControlsRef}
            onSelect={setSelectedObject}
            onHoverChange={onHoverChange}
        >
            {model && createElement('primitive', { object: model })}
            {hasSelectedObject && (
                <Html fullscreen className='single-model-viewer__controls-layer'>
                    <div className='single-model-viewer__controls d-flex column gap-075' role='group' aria-label='Selected model controls'>
                        <div className='d-flex column gap-025'>
                            <span className='single-model-viewer__controls-title font-size-1 font-weight-6 color-primary'>
                                Selected model controls
                            </span>
                            <p className='font-size-1 color-secondary'>
                                Use the buttons below or press Ctrl/Cmd + arrow keys. Hold Shift with left or right arrows to rotate Z.
                            </p>
                        </div>
                        <div className='single-model-viewer__controls-grid'>
                            {controls.map(renderControl)}
                        </div>
                        <div className='single-model-viewer__controls-footer'>
                            <Button variant='outline' intent='neutral' size='sm' onClick={resetModel}>
                                Reset orientation
                            </Button>
                            <Button variant='ghost' intent='neutral' size='sm' onClick={deselect}>
                                Deselect
                            </Button>
                        </div>
                    </div>
                </Html>
            )}
        </SimulationCellBox>
    );
};

export default SingleModelViewer;
