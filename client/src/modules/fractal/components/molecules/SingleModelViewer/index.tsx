import useSlicingPlanes from '@/modules/fractal/hooks/use-slicing-planes';
import useGlbScene from '@/modules/fractal/hooks/use-glb-scene';
import SimulationCellBox from '@/modules/fractal/components/molecules/SimulationCellBox';
import { areModelWorldBoundsEqual } from '@/modules/fractal/utilities/model-world-bounds';
import { buildCellBoxTransforms, calculateBoxTransforms, getGroundOffset } from '@/modules/fractal/utilities/box-utils';
import { debugFractal, warnFractal } from '@/modules/fractal/utilities/debug-log';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { resolveGlbResource } from '@/modules/fractal/api/service/compute-glb-url';
import { useCanvasAccessMode } from '@/modules/canvas/api/access';
import { fitPerspectiveCameraToBox } from '@/modules/fractal/utilities/camera-fit';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useEffect, useCallback, useRef } from 'react';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { BoxBounds, ModelLoadingState } from '@/modules/fractal/api/entities/model';
import type { SlicePlaneConfig } from '@/modules/fractal/api/entities/scene';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import type { DislocationLineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { FC, RefObject } from 'react';

interface OptionalVec3 {
    x?: number;
    y?: number;
    z?: number;
}

interface AutoFitBoxTransforms {
    scale: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
    groundOffset?: number;
}

const buildWorldBoundsFromModel = (
    bounds: BoundsInfo,
    transforms: AutoFitBoxTransforms
): THREE.Box3 => {
    const groundOffset = transforms.groundOffset || 0;
    const worldOffset = new THREE.Vector3(
        transforms.position.x,
        transforms.position.y,
        transforms.position.z + groundOffset
    );
    const min = bounds.box.min.clone().multiplyScalar(transforms.scale).add(worldOffset);
    const max = bounds.box.max.clone().multiplyScalar(transforms.scale).add(worldOffset);

    return new THREE.Box3(min, max);
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
    dislocationLineSettings?: DislocationLineSceneSettings;
    sceneVisualOverrides: SceneVisualOverrides;
    setModelWorldBounds?: (bounds: ModelWorldBounds | null) => void;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
    rotation?: OptionalVec3;
    position?: OptionalVec3;
    scale?: number;
    autoFit?: boolean;
    autoFitKeyOverride?: string | null;
    orbitControlsRef?: RefObject<OrbitControlsHandle | null>;
    enableSlice?: boolean;
    updateThrottle?: number;
    onSelect?: () => void;
    isSelected?: boolean;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
}

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
    dislocationLineSettings,
    sceneVisualOverrides,
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
    autoFit = true,
    autoFitKeyOverride,
    orbitControlsRef,
    enableSlice = true,
    updateThrottle = 16,
    onSelect,
    isSelected = false,
    onContentTypeDetected
}) => {
    const lastEmittedModelWorldBoundsReference = useRef<ModelWorldBounds | null>(null);
    const autoFitKeyRef = useRef<string | null>(null);
    const autoFitAppliedRef = useRef(!autoFit);
    const autoFitWaitLoggedRef = useRef(false);
    // Imperative container for the 3D model — keeps the heavy Object3D out of
    // React's reconciliation tree entirely (matches old fast architecture).
    const modelContainerRef = useRef<THREE.Group>(null!);

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
    const autoFitKey = useMemo(() => {
        if (autoFitKeyOverride !== undefined) {
            return autoFit ? autoFitKeyOverride : null;
        }

        return autoFit
            ? [
                trajectoryId,
                currentTimestep ?? 'none',
                boxBounds.xlo,
                boxBounds.xhi,
                boxBounds.ylo,
                boxBounds.yhi,
                boxBounds.zlo,
                boxBounds.zhi
            ].join(':')
            : null;
    }, [
        autoFit,
        autoFitKeyOverride,
        boxBounds.xhi,
        boxBounds.xlo,
        boxBounds.yhi,
        boxBounds.ylo,
        boxBounds.zhi,
        boxBounds.zlo,
        currentTimestep,
        trajectoryId
    ]);

    const modelWorldBounds = useMemo<ModelWorldBounds>(() => {
        const scaleFactor = cellBoxTransforms.scale;
        const worldPosition = cellBoxTransforms.position;
        const groundZOffset = cellBoxTransforms.groundOffset || 0;
        return {
            min: {
                x: boxBounds.xlo * scaleFactor + worldPosition.x,
                y: boxBounds.ylo * scaleFactor + worldPosition.y,
                z: boxBounds.zlo * scaleFactor + worldPosition.z + groundZOffset
            },
            max: {
                x: boxBounds.xhi * scaleFactor + worldPosition.x,
                y: boxBounds.yhi * scaleFactor + worldPosition.y,
                z: boxBounds.zhi * scaleFactor + worldPosition.z + groundZOffset
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

    const canvasMode = useCanvasAccessMode();
    const glbResource = useMemo(() =>
        resolveGlbResource({
            teamId: teamId || '',
            trajectoryId,
            currentTimestep,
            analysisId,
            activeScene: sceneConfig,
            mode: canvasMode
        }),
        [teamId, trajectoryId, currentTimestep, analysisId, sceneConfig, canvasMode]
    );
    const url = glbResource.url;

    const handleEmptyData = useCallback(async () => {
        return;
    }, []);

    const sceneKey = useMemo(() => getSceneKey(sceneConfig), [sceneConfig]);

    const {
        modelBounds,
        loadError,
        deselect,
        setSelectedObject,
        onHoverChange
    } = useGlbScene({
        url,
        resourceKey: glbResource.resourceKey,
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
        dislocationLineSettings,
        sceneVisualOverrides,
        activeModelBounds,
        onModelBoundsChanged,
        onLoadingStateChanged,
        onContentTypeDetected
    }, modelContainerRef);

    useEffect(() => {
        autoFitKeyRef.current = autoFitKey;
        autoFitAppliedRef.current = !autoFit;
        autoFitWaitLoggedRef.current = false;
    }, [autoFit, autoFitKey]);

    useEffect(() => {
        debugFractal('single-model.request', {
            trajectoryId,
            timestep: currentTimestep,
            sceneKey,
            url,
            autoFit,
            autoFitKey,
            boxBounds
        });
    }, [autoFit, autoFitKey, boxBounds, currentTimestep, sceneKey, trajectoryId, url]);

    const { invalidate } = useThree();

    useEffect(() => {
        if (!autoFit || autoFitAppliedRef.current || !autoFitKeyRef.current) {
            return;
        }
        if (!modelBounds) {
            return;
        }

        const controls = orbitControlsRef?.current;
        if (!controls) {
            return;
        }

        const camera = controls.object;
        if (!(camera instanceof THREE.PerspectiveCamera)) {
            autoFitAppliedRef.current = true;
            warnFractal('single-model.autofit-non-perspective-camera', {
                trajectoryId,
                timestep: currentTimestep,
                sceneKey
            });
            return;
        }

        const worldBox = buildWorldBoundsFromModel(modelBounds, cellBoxTransforms);
        if (worldBox.isEmpty()) {
            autoFitAppliedRef.current = true;
            warnFractal('single-model.autofit-empty-world-box', {
                trajectoryId,
                timestep: currentTimestep,
                sceneKey
            });
            return;
        }

        const worldCenter = worldBox.getCenter(new THREE.Vector3());
        const worldSize = worldBox.getSize(new THREE.Vector3());
        const previousCameraPosition = camera.position.toArray();
        const previousTarget = controls.target.toArray();
        fitPerspectiveCameraToBox(camera, worldBox, controls);
        autoFitAppliedRef.current = true;
        debugFractal('single-model.autofit-applied', {
            trajectoryId,
            timestep: currentTimestep,
            sceneKey,
            source: 'model-bounds-effect',
            worldCenter: worldCenter.toArray(),
            worldSize: worldSize.toArray(),
            previousCameraPosition,
            nextCameraPosition: camera.position.toArray(),
            previousTarget,
            nextTarget: controls.target.toArray()
        });
        invalidate();
    }, [
        autoFit,
        autoFitKey,
        cellBoxTransforms,
        currentTimestep,
        invalidate,
        modelBounds,
        orbitControlsRef,
        sceneKey,
        trajectoryId
    ]);

    useEffect(() => {
        if (!isSelected) {
            deselect();
        }
    }, [isSelected, deselect]);

    useEffect(() => {
        if (!modelBounds) {
            return;
        }

        debugFractal('single-model.bounds', {
            trajectoryId,
            timestep: currentTimestep,
            sceneKey,
            center: modelBounds.center.toArray(),
            size: modelBounds.size.toArray(),
            radius: modelBounds.boundingSphere.radius
        });
    }, [currentTimestep, modelBounds, sceneKey, trajectoryId]);

    useEffect(() => {
        if (!loadError) {
            return;
        }

        warnFractal('single-model.load-error', {
            trajectoryId,
            timestep: currentTimestep,
            sceneKey,
            error: loadError,
            url
        });
    }, [currentTimestep, loadError, sceneKey, trajectoryId, url]);

    return (
        <SimulationCellBox
            sceneKey={sceneKey}
            boxBounds={boxBounds}
            transforms={cellBoxTransforms}
            orbitControlsRef={orbitControlsRef}
            onSelect={setSelectedObject}
            onHoverChange={onHoverChange}
        >
            {/* Imperative model container — the loaded 3D model is attached via
                scene.add() in useGlbScene, never through React reconciliation. */}
            <group ref={modelContainerRef} userData={{ isScreenshotCaptureTarget: true }} />
        </SimulationCellBox>
    );
};

export default SingleModelViewer;
