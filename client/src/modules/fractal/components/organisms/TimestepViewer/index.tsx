import React, { useMemo, forwardRef } from 'react';
import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import { getRenderableScenes } from '@/modules/fractal/utilities/scene-utils';
import type { BoxBounds, ModelLoadingState } from '@/modules/fractal/types';
import type { SlicePlaneConfig } from '@/modules/fractal/types/configuration';
import type { SceneObjectType } from '@/modules/fractal/api/entities/fractal';
import type { BoundsInfo } from '@/modules/fractal/core/model-transform';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/fractal';

interface TimestepViewerProps {
    teamId?: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId?: string;
    activeScenes: SceneObjectType[];
    pluginScenes: Array<{ exposureId: string; exportType?: string }>;
    slicePlaneConfig: SlicePlaneConfig;
    boxBounds: BoxBounds;
    pointSizeMultiplier: number;
    sceneOpacities: Record<string, number>;
    setModelWorldBounds?: (bounds: ModelWorldBounds | null) => void;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
    rotation?: { x?: number; y?: number; z?: number };
    position?: { x?: number; y?: number; z?: number };
    scale?: number;
    autoFit?: boolean;
    orbitControlsRef?: React.RefObject<{ enabled: boolean } | null>;
    enableSlice?: boolean;
    enableInstancing?: boolean;
    updateThrottle?: number;
    spacing?: number;
    forceDefaultScene?: boolean;
}

export interface TimestepViewerRef {
    loadModel: () => void;
}

const TimestepViewer = forwardRef<TimestepViewerRef, TimestepViewerProps>(({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
    activeScenes: storeActiveScenes,
    pluginScenes,
    slicePlaneConfig,
    boxBounds,
    pointSizeMultiplier,
    sceneOpacities,
    setModelWorldBounds,
    activeModelBounds,
    onModelBoundsChanged,
    onLoadingStateChanged,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing = true,
    updateThrottle = 16,
    spacing = 0.5,
    forceDefaultScene = false
}, _ref) => {
    const scenesToRender = useMemo(() => {
        return getRenderableScenes(storeActiveScenes, pluginScenes, forceDefaultScene);
    }, [storeActiveScenes, pluginScenes, forceDefaultScene]);

    const [modelHeights, setModelHeights] = React.useState<Record<number, number>>({});
    const [selectedModelIndex, setSelectedModelIndex] = React.useState<number | null>(null);

    const handleModelLoaded = React.useCallback((index: number, bounds: BoundsInfo) => {
        if (bounds?.size?.y) {
            setModelHeights((prev) => {
                if (Math.abs(prev[index] - bounds.size.y) < 0.01) return prev;
                return { ...prev, [index]: bounds.size.y };
            });
        }
    }, []);

    const scenePositions = useMemo(() => {
        if (scenesToRender.length === 0) return [] as Array<{ x?: number; y?: number; z?: number }>;

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

    if (scenesToRender.length === 0) return null;

    return (
        <>
            {scenesToRender.map((scene, index) => {
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
                        pointSizeMultiplier={pointSizeMultiplier}
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
                    />
                );
            })}
        </>
    );
});

TimestepViewer.displayName = 'TimestepViewer';

export default TimestepViewer;
