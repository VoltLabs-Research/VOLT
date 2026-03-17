import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import { getRenderableScenes } from '@/modules/fractal/utilities/scene-utils';
import { useMemo, forwardRef, useState, useCallback } from 'react';
import type { BoxBounds, ModelLoadingState, OrbitControlsHandle } from '@/modules/fractal/types';
import type { SlicePlaneConfig } from '@/modules/fractal/types/configuration';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { RefObject } from 'react';

interface PluginSceneDescriptor {
    exposureId: string;
    exportType?: string;
};

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
    pluginScenes: PluginSceneDescriptor[];
    slicePlaneConfig: SlicePlaneConfig;
    boxBounds: BoxBounds;
    pointCloudSettings: PointCloudSceneSettings;
    sceneOpacities: Record<string, number>;
    setModelWorldBounds?: (bounds: ModelWorldBounds | null) => void;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
    rotation?: OptionalPosition;
    position?: OptionalPosition;
    scale?: number;
    autoFit?: boolean;
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
    pluginScenes,
    slicePlaneConfig,
    boxBounds,
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
    enableInstancing = true,
    updateThrottle = 16,
    spacing = 0.5,
    forceDefaultScene = false,
    onContentTypeDetected
}, _ref) => {
    const scenesToRender = useMemo(() => {
        return getRenderableScenes(storeActiveScenes, pluginScenes, forceDefaultScene);
    }, [storeActiveScenes, pluginScenes, forceDefaultScene]);

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
                sceneOpacities={sceneOpacities}
                setModelWorldBounds={setModelWorldBounds}
                activeModelBounds={activeModelBounds}
                onModelBoundsChanged={onModelBoundsChanged}
                onLoadingStateChanged={onLoadingStateChanged}
                rotation={rotation}
                position={scenePosition}
                scale={scale}
                autoFit={autoFit}
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
        sceneOpacities,
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
