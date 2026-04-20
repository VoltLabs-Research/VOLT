import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import { getRenderableScenes, getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { DEFAULT_DISLOCATION_LINE_WIDTH } from '@/modules/canvas/utilities/plugin-exposure-export';
import { Exporter } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import type { BoxBounds, ModelLoadingState, OrbitControlsHandle } from '@/modules/fractal/types';
import type { SlicePlaneConfig } from '@/modules/fractal/types/configuration';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import type { DislocationLineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { RefObject } from 'react';

interface OptionalPosition {
    x?: number;
    y?: number;
    z?: number;
};

interface TimestepViewerProps {
    teamId?: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId?: string;
    activeScenes: SceneObjectType[];
    slicePlaneConfig: SlicePlaneConfig;
    boxBounds: BoxBounds;
    pointCloudSettings: PointCloudSceneSettings;
    sceneVisualOverrides: SceneVisualOverrides;
    setModelWorldBounds?: (bounds: ModelWorldBounds | null) => void;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
    rotation?: OptionalPosition;
    position?: OptionalPosition;
    scale?: number;
    autoFit?: boolean;
    autoFitKeyOverride?: string | null;
    orbitControlsRef?: RefObject<OrbitControlsHandle | null>;
    enableSlice?: boolean;
    enableInstancing?: boolean;
    updateThrottle?: number;
    forceDefaultScene?: boolean;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
};

export interface TimestepViewerRef {
    loadModel: () => void;
};

// Matches the `targetSize` used by calculateBoxTransforms (box-utils.ts) —
// every model is auto-scaled so its largest dimension is this many world units.
const WORLD_MODEL_EXTENT = 8;
const SPAWN_PADDING = 2;
const SPAWN_STEP = WORLD_MODEL_EXTENT + SPAWN_PADDING;

const computeSpawnPosition = (
    camera: THREE.Camera,
    existing: OptionalPosition[]
): OptionalPosition => {
    // Camera-right (perpendicular to forward and scene-up) drops the new model
    // sideways within the current view — not behind, not too far.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up);
    if (right.lengthSq() < 1e-6) {
        right.set(1, 0, 0);
    } else {
        right.normalize();
    }

    // Place the new model just past the rightmost existing one along the
    // camera-right axis, so it's always visibly adjacent rather than stacked.
    let maxProjection = -Infinity;
    const rightmost = new THREE.Vector3();
    for (const pos of existing) {
        const p = new THREE.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
        const proj = p.dot(right);
        if (proj > maxProjection) {
            maxProjection = proj;
            rightmost.copy(p);
        }
    }

    const spawn = rightmost.clone().addScaledVector(right, SPAWN_STEP);
    return { x: spawn.x, y: spawn.y, z: spawn.z };
};

const TimestepViewer = forwardRef<TimestepViewerRef, TimestepViewerProps>(({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
    activeScenes: storeActiveScenes,
    slicePlaneConfig,
    boxBounds,
    pointCloudSettings,
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
    enableInstancing = true,
    updateThrottle = 16,
    forceDefaultScene = false,
    onContentTypeDetected
}, _ref) => {
    const scenesToRender = useMemo(() => {
        return getRenderableScenes(storeActiveScenes, forceDefaultScene);
    }, [storeActiveScenes, forceDefaultScene]);

    const camera = useThree((state) => state.camera);
    // Stable spawn position per scene key — computed once on first appearance.
    // Keeps existing models put when a new scene is added.
    const scenePositionsRef = useRef<Map<string, OptionalPosition>>(new Map());
    const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null);

    const handleModelLoaded = useCallback((_sceneKey: string, _bounds: BoundsInfo) => {
        // Bounds are model-local units (pre cellBoxTransforms scale) so we
        // don't use them for spawn sizing — all trajectory models share the
        // same world extent via calculateBoxTransforms. Keep the hook for
        // future per-scene bookkeeping.
    }, []);

    const scenePositions = useMemo<OptionalPosition[]>(() => {
        if (scenesToRender.length === 0) {
            return [];
        }

        const resolved: OptionalPosition[] = [];

        for (const scene of scenesToRender) {
            const sceneKey = getSceneKey(scene);
            const cached = scenePositionsRef.current.get(sceneKey);
            if (cached) {
                resolved.push(cached);
                continue;
            }

            // First time we see this scene: assign a stable spawn position.
            const isFirst = scenePositionsRef.current.size === 0;
            let spawn: OptionalPosition;
            if (isFirst) {
                spawn = {
                    x: position.x ?? 0,
                    y: position.y ?? 0,
                    z: position.z ?? 0
                };
            } else {
                spawn = computeSpawnPosition(
                    camera,
                    Array.from(scenePositionsRef.current.values())
                );
            }

            scenePositionsRef.current.set(sceneKey, spawn);
            resolved.push(spawn);
        }

        return resolved;
    }, [scenesToRender, camera, position]);

    // Drop cache entries for removed scenes so that re-adding a scene after
    // removal gets a fresh spawn rather than a stale position.
    useEffect(() => {
        const liveKeys = new Set(scenesToRender.map(getSceneKey));
        for (const key of scenePositionsRef.current.keys()) {
            if (!liveKeys.has(key)) {
                scenePositionsRef.current.delete(key);
            }
        }
    }, [scenesToRender]);

    const renderScene = useCallback((scene: SceneObjectType, index: number) => {
        const scenePosition = scenePositions[index] ?? position;
        const sceneKey = getSceneKey(scene);
        const sceneOverride = sceneVisualOverrides[sceneKey];
        const dislocationLineSettings: DislocationLineSceneSettings | undefined = scene.source === 'plugin'
            && scene.sceneRenderMetadata?.exporter === Exporter.DISLOCATION
            ? {
                baseLineWidth: scene.sceneRenderMetadata.defaultLineWidth ?? DEFAULT_DISLOCATION_LINE_WIDTH,
                lineWidth: sceneOverride?.lineWidth
                    ?? scene.sceneRenderMetadata.defaultLineWidth
                    ?? DEFAULT_DISLOCATION_LINE_WIDTH
            }
            : undefined;
        // SingleModelViewer renders with `disableAutoTransform: true`, so its
        // `position` prop never reaches the model. We apply the spawn offset
        // via a wrapping group — composes cleanly with DragControls and the
        // internal cellBoxTransforms.
        const spawnPosition: [number, number, number] = [
            scenePosition.x ?? 0,
            scenePosition.y ?? 0,
            scenePosition.z ?? 0
        ];

        return (
            <group
                key={`${scene.source}-${scene.sceneType}-${'exposureId' in scene ? scene.exposureId : ''}-${index}`}
                position={spawnPosition}
            >
                <SingleModelViewer
                    teamId={teamId}
                    trajectoryId={trajectoryId}
                    currentTimestep={currentTimestep}
                    analysisId={analysisId}
                    sceneConfig={scene}
                    slicePlaneConfig={slicePlaneConfig}
                    boxBounds={boxBounds}
                    pointSizeMultiplier={pointCloudSettings.pointSizeMultiplier}
                    pointCloudSettings={pointCloudSettings}
                    dislocationLineSettings={dislocationLineSettings}
                    sceneVisualOverrides={sceneVisualOverrides}
                    setModelWorldBounds={setModelWorldBounds}
                    activeModelBounds={activeModelBounds}
                    onModelBoundsChanged={onModelBoundsChanged}
                    onLoadingStateChanged={onLoadingStateChanged}
                    rotation={rotation}
                    scale={scale}
                    autoFit={autoFit}
                    autoFitKeyOverride={autoFitKeyOverride}
                    orbitControlsRef={orbitControlsRef}
                    enableSlice={enableSlice}
                    enableInstancing={enableInstancing}
                    updateThrottle={updateThrottle}
                    isPrimary={index === scenesToRender.length - 1}
                    onModelLoaded={(bounds) => handleModelLoaded(sceneKey, bounds)}
                    onSelect={() => setSelectedModelIndex(index)}
                    isSelected={selectedModelIndex === index}
                    onContentTypeDetected={onContentTypeDetected}
                />
            </group>
        );
    }, [
        activeModelBounds,
        analysisId,
        autoFit,
        autoFitKeyOverride,
        boxBounds,
        currentTimestep,
        enableInstancing,
        enableSlice,
        handleModelLoaded,
        onLoadingStateChanged,
        onModelBoundsChanged,
        orbitControlsRef,
        pointCloudSettings,
        position,
        rotation,
        scale,
        sceneVisualOverrides,
        scenePositions,
        scenesToRender.length,
        selectedModelIndex,
        setModelWorldBounds,
        slicePlaneConfig,
        teamId,
        trajectoryId,
        updateThrottle,
        onContentTypeDetected
    ]);

    if (scenesToRender.length === 0) return null;

    return (
        <>
            {scenesToRender.map(renderScene)}
        </>
    );
});

TimestepViewer.displayName = 'TimestepViewer';

export default TimestepViewer;
