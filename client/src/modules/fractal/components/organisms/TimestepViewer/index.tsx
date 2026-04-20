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

const DEFAULT_MODEL_EXTENT = 12;
const MIN_SPAWN_PADDING = 2;

const computeSpawnPosition = (
    camera: THREE.Camera,
    basePosition: OptionalPosition,
    existing: Array<{ pos: OptionalPosition; extent: number }>,
    newExtent: number
): OptionalPosition => {
    // Use camera-right (perpendicular to forward and scene-up) so the new
    // model lands sideways within the current view — not behind, not too far.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up);
    if (right.lengthSq() < 1e-6) {
        right.set(1, 0, 0);
    } else {
        right.normalize();
    }

    const anchor = new THREE.Vector3(
        basePosition.x ?? 0,
        basePosition.y ?? 0,
        basePosition.z ?? 0
    );
    if (existing.length > 0) {
        const sum = existing.reduce(
            (acc, entry) => {
                acc.x += entry.pos.x ?? 0;
                acc.y += entry.pos.y ?? 0;
                acc.z += entry.pos.z ?? 0;
                return acc;
            },
            new THREE.Vector3()
        );
        anchor.copy(sum.divideScalar(existing.length));
    }

    const existingReach = existing.reduce((max, entry) => {
        return Math.max(max, entry.extent / 2);
    }, 0);
    const offset = existingReach + newExtent / 2 + MIN_SPAWN_PADDING;

    const spawn = anchor.clone().addScaledVector(right, offset);
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
    // Extent per scene key (widest dimension of its bounding box) — used to
    // size the spawn offset of the next model so it doesn't overlap.
    const sceneExtentsRef = useRef<Map<string, number>>(new Map());
    // Stable spawn position per scene key — computed once on first appearance.
    // Keeps existing models put when a new scene is added.
    const scenePositionsRef = useRef<Map<string, OptionalPosition>>(new Map());
    const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null);

    const handleModelLoaded = useCallback((sceneKey: string, bounds: BoundsInfo) => {
        if (!bounds?.size) return;

        const extent = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
        if (!Number.isFinite(extent) || extent <= 0) return;

        const previous = sceneExtentsRef.current.get(sceneKey);
        if (previous !== undefined && Math.abs(previous - extent) < 0.01) return;

        sceneExtentsRef.current.set(sceneKey, extent);
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
                const existing = Array.from(scenePositionsRef.current.entries()).map(([key, pos]) => ({
                    pos,
                    extent: sceneExtentsRef.current.get(key) ?? DEFAULT_MODEL_EXTENT
                }));
                const newExtent = sceneExtentsRef.current.get(sceneKey) ?? DEFAULT_MODEL_EXTENT;
                spawn = computeSpawnPosition(camera, position, existing, newExtent);
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
                sceneExtentsRef.current.delete(key);
            }
        }
    }, [scenesToRender]);

    const renderScene = useCallback((scene: SceneObjectType, index: number) => {
        const scenePosition = scenePositions[index] || position;
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

        return (
            <SingleModelViewer
                teamId={teamId}
                key={`${scene.source}-${scene.sceneType}-${'exposureId' in scene ? scene.exposureId : ''}-${index}`}
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
                position={scenePosition}
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
