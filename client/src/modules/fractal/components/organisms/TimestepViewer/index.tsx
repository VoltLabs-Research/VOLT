import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import BondsModelViewer from '@/modules/fractal/components/molecules/BondsModelViewer';
import { getRenderableScenes, getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { DEFAULT_LINE_WIDTH } from '@/modules/canvas/utils/plugin-exposure-export';
import { resolveBondLineSettings } from '@/modules/fractal/services/bond-render';
import { Exporter } from '@volt/contracts/modules/plugin/domain/enums';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useState, useRef, useEffect } from 'react';
import type { OrbitControlsHandle } from '@/modules/fractal/contracts';
import type { ModelLoadingState } from '@/modules/fractal/contracts/model';
import type { BoxBounds } from '@volt/contracts/modules/trajectory/domain';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';
import type { LineEntityHighlight, LineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/contracts/scene-config';
import type { BoundsInfo } from '@/modules/fractal/utils/model-transform';
import type { ModelWorldBounds } from '@/modules/fractal/contracts/model';
import type { RefObject } from 'react';

interface OptionalPosition {
    x?: number;
    y?: number;
    z?: number;
}

interface TimestepViewerProps {
    teamId?: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId?: string;
    activeScenes: SceneObjectType[];
    boxBounds: BoxBounds;
    pointCloudSettings: PointCloudSceneSettings;
    sceneVisualOverrides: SceneVisualOverrides;
    lineHighlight?: LineEntityHighlight;
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
    updateThrottle?: number;
    forceDefaultScene?: boolean;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
}

const WORLD_MODEL_EXTENT = 8;
const SPAWN_PADDING = 2;
const SPAWN_STEP = WORLD_MODEL_EXTENT + SPAWN_PADDING;

const computeSpawnPosition = (
    camera: THREE.Camera,
    existing: OptionalPosition[]
): OptionalPosition => {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    else right.normalize();

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

const TimestepViewer = ({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
    activeScenes: storeActiveScenes,
    boxBounds,
    pointCloudSettings,
    sceneVisualOverrides,
    lineHighlight,
    setModelWorldBounds,
    activeModelBounds,
    onModelBoundsChanged,
    onLoadingStateChanged,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    autoFitKeyOverride,
    orbitControlsRef,
    enableSlice = true,
    updateThrottle = 16,
    forceDefaultScene = false,
    onContentTypeDetected
}: TimestepViewerProps) => {
    const scenesToRender = getRenderableScenes(storeActiveScenes, forceDefaultScene);
    const camera = useThree((state) => state.camera);
    const scenePositionsRef = useRef<Map<string, OptionalPosition>>(new Map());
    const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null);

    useEffect(() => {
        const liveKeys = new Set(scenesToRender.map(getSceneKey));
        for (const key of scenePositionsRef.current.keys()) {
            if (!liveKeys.has(key)) {
                scenePositionsRef.current.delete(key);
            }
        }
    }, [scenesToRender]);

    if (scenesToRender.length === 0) return null;

    const resolveSpawnPosition = (scene: SceneObjectType): OptionalPosition => {
        const sceneKey = getSceneKey(scene);
        const cached = scenePositionsRef.current.get(sceneKey);
        if (cached) return cached;
        const isFirst = scenesToRender.length <= 1;
        let spawn: OptionalPosition;
        if (isFirst) {
            spawn = { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 };
        } else {
            const existing = Array.from(scenePositionsRef.current.values());
            spawn = existing.length === 0
                ? { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 }
                : computeSpawnPosition(camera, existing);
        }
        scenePositionsRef.current.set(sceneKey, spawn);
        return spawn;
    };

    return (
        <>
            {scenesToRender.map((scene, index) => {
                const sceneKey = getSceneKey(scene);
                const sceneOverride = sceneVisualOverrides[sceneKey];
                const isBondScene = scene.source === 'plugin'
                    && scene.sceneRenderMetadata?.exporter === Exporter.BOND;
                const lineSettings: LineSceneSettings | undefined = scene.source === 'plugin'
                    && scene.sceneRenderMetadata?.exporter === Exporter.LINE
                    ? {
                        baseLineWidth: scene.sceneRenderMetadata.defaultLineWidth ?? DEFAULT_LINE_WIDTH,
                        lineWidth: sceneOverride?.lineWidth
                            ?? scene.sceneRenderMetadata.defaultLineWidth
                            ?? DEFAULT_LINE_WIDTH
                    }
                    : undefined;
                const bondLineSettings: LineSceneSettings | undefined = isBondScene
                    ? resolveBondLineSettings(
                        { radius: (scene.sceneRenderMetadata?.defaultLineWidth ?? 0) / 2 || undefined },
                        sceneOverride?.lineWidth
                    )
                    : undefined;
                const scenePosition = resolveSpawnPosition(scene);
                const spawnPosition: [number, number, number] = [
                    scenePosition.x ?? 0,
                    scenePosition.y ?? 0,
                    scenePosition.z ?? 0
                ];
                const ModelViewer = isBondScene ? BondsModelViewer : SingleModelViewer;
                return (
                    <group
                        key={`${scene.source}-${scene.sceneType}-${'exposureId' in scene ? scene.exposureId : ''}-${index}`}
                        position={spawnPosition}
                    >
                        <ModelViewer
                            teamId={teamId}
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            analysisId={analysisId}
                            sceneConfig={scene}
                            boxBounds={boxBounds}
                            pointSizeMultiplier={pointCloudSettings.pointSizeMultiplier}
                            pointCloudSettings={pointCloudSettings}
                            lineSettings={bondLineSettings ?? lineSettings}
                            lineHighlight={lineHighlight?.sceneKey === sceneKey ? lineHighlight : undefined}
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
                            updateThrottle={updateThrottle}
                            onSelect={() => setSelectedModelIndex(index)}
                            isSelected={selectedModelIndex === index}
                            onContentTypeDetected={onContentTypeDetected}
                        />
                    </group>
                );
            })}
        </>
    );
};

export default TimestepViewer;
