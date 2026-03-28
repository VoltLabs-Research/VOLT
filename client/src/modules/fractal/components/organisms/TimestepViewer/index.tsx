import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import { getRenderableScenes, getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { DEFAULT_DISLOCATION_LINE_WIDTH } from '@/modules/canvas/utilities/plugin-exposure-export';
import { Exporter } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { useMemo, forwardRef, useState, useCallback } from 'react';
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
    spacing?: number;
    forceDefaultScene?: boolean;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
};

export interface TimestepViewerRef {
    loadModel: () => void;
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
    spacing = 0.5,
    forceDefaultScene = false,
    onContentTypeDetected
}, _ref) => {
    const scenesToRender = useMemo(() => {
        return getRenderableScenes(storeActiveScenes, forceDefaultScene);
    }, [storeActiveScenes, forceDefaultScene]);

    const [modelHeights, setModelHeights] = useState<Record<number, number>>({});
    const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null);

    const handleModelLoaded = useCallback((index: number, bounds: BoundsInfo) => {
        if (bounds?.size?.y) {
            setModelHeights((prev) => {
                if (Math.abs(prev[index] - bounds.size.y) < 0.01) return prev;
                return { ...prev, [index]: bounds.size.y };
            });
        }
    }, []);

    const scenePositions = useMemo<OptionalPosition[]>(() => {
        if (scenesToRender.length === 0) {
            return [];
        }

        let previousCenter = position.y || 0;
        let previousHalfHeight = 0;

        return scenesToRender.map((_, index) => {
            const height = modelHeights[index] || 12;
            const halfHeight = height / 2;
            const padding = spacing;

            let currentY;
            if (index === 0) {
                currentY = position.y || 0;
                previousHalfHeight = halfHeight;
            } else {
                currentY = previousCenter + previousHalfHeight + padding + halfHeight;
                previousCenter = currentY;
                previousHalfHeight = halfHeight;
            }

            if (index === 0) {
                previousCenter = currentY;
            }

            return {
                ...position,
                y: currentY
            };
        });
    }, [scenesToRender, modelHeights, position, spacing]);

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
                onModelLoaded={(bounds) => handleModelLoaded(index, bounds)}
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
