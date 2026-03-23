import useSlicingPlanes from '@/modules/fractal/hooks/use-slicing-planes';
import useGlbScene from '@/modules/fractal/hooks/use-glb-scene';
import SimulationCellBox from '@/modules/fractal/components/molecules/SimulationCellBox';
import { areModelWorldBoundsEqual } from '@/modules/fractal/utilities/model-world-bounds';
import { buildCellBoxTransforms, calculateBoxTransforms, getGroundOffset } from '@/modules/fractal/utilities/box-utils';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { computeGlbUrl } from '@/modules/fractal/api/service/compute-glb-url';
import './SingleModelViewer.css';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useEffect, useCallback, useRef } from 'react';
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

interface AutoFitBoxTransforms {
    scale: number;
    position: {
        x: number;
        y: number;
        z: number;
    };
    groundOffset?: number;
};

const DEFAULT_CAMERA_DIRECTION = new THREE.Vector3(1, 1, 0.75).normalize();

const buildWorldBoundsFromBox = (
    boxBounds: BoxBounds,
    transforms: AutoFitBoxTransforms
): THREE.Box3 => {
    const min = new THREE.Vector3(
        boxBounds.xlo * transforms.scale + transforms.position.x,
        boxBounds.ylo * transforms.scale + transforms.position.y,
        boxBounds.zlo * transforms.scale + transforms.position.z + (transforms.groundOffset || 0)
    );
    const max = new THREE.Vector3(
        boxBounds.xhi * transforms.scale + transforms.position.x,
        boxBounds.yhi * transforms.scale + transforms.position.y,
        boxBounds.zhi * transforms.scale + transforms.position.z + (transforms.groundOffset || 0)
    );

    return new THREE.Box3(min, max);
};

const fitPerspectiveCameraToBox = (
    camera: THREE.PerspectiveCamera,
    controls: OrbitControlsHandle,
    worldBox: THREE.Box3
) => {
    const sphere = worldBox.getBoundingSphere(new THREE.Sphere());
    const nextTarget = sphere.center.clone();
    const currentDirection = camera.position.clone().sub(controls.target);
    const direction = currentDirection.lengthSq() > 0.0001
        ? currentDirection.normalize()
        : DEFAULT_CAMERA_DIRECTION;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const fitFov = Math.min(verticalFov, horizontalFov);
    const desiredDistance = (sphere.radius / Math.sin(fitFov / 2)) * 1.2;
    const clampedDistance = Math.min(
        controls.maxDistance,
        Math.max(controls.minDistance, desiredDistance)
    );

    controls.target.copy(nextTarget);
    camera.position.copy(nextTarget.clone().addScaledVector(direction, clampedDistance));
    camera.updateProjectionMatrix();
    controls.update();
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
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
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
    autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing: _enableInstancing = true,
    updateThrottle = 16,
    isPrimary: _isPrimary = false,
    onModelLoaded,
    onSelect,
    isSelected = false,
    onContentTypeDetected
}) => {
    const lastEmittedModelWorldBoundsReference = useRef<ModelWorldBounds | null>(null);
    const autoFitKeyRef = useRef<string | null>(null);
    const autoFitAppliedRef = useRef(!autoFit);
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
        onLoadingStateChanged,
        onContentTypeDetected
    }, modelContainerRef);

    useEffect(() => {
        autoFitKeyRef.current = autoFitKey;
        autoFitAppliedRef.current = !autoFit;
    }, [autoFit, autoFitKey]);

    useFrame((state) => {
        if (!autoFit || autoFitAppliedRef.current || !autoFitKeyRef.current) {
            return;
        }

        const controls = orbitControlsRef?.current
            ?? ((state as typeof state & { controls?: OrbitControlsHandle | null }).controls ?? null);

        if (!controls) {
            return;
        }

        const camera = controls.object;
        if (!(camera instanceof THREE.PerspectiveCamera)) {
            autoFitAppliedRef.current = true;
            return;
        }

        const worldBox = buildWorldBoundsFromBox(boxBounds, cellBoxTransforms);
        if (worldBox.isEmpty()) {
            autoFitAppliedRef.current = true;
            return;
        }

        fitPerspectiveCameraToBox(camera, controls, worldBox);
        autoFitAppliedRef.current = true;
        state.invalidate();
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
            {/* Imperative model container — the loaded 3D model is attached via
                scene.add() in useGlbScene, never through React reconciliation. */}
            <group ref={modelContainerRef} userData={{ isScreenshotCaptureTarget: true }} />
        </SimulationCellBox>
    );
};

export default SingleModelViewer;
