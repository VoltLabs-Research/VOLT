import React, { useMemo, forwardRef } from 'react';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import SingleModelViewer from '@/modules/fractal/presentation/components/molecules/SingleModelViewer';
import { getRenderableScenes } from '@/modules/fractal/presentation/utilities/sceneUtils';

interface TimestepViewerProps {
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId?: string;
    activeScene?: {
        sceneType: string;
        source: string;
        analysisId?: string;
        exposureId?: string;
        property?: string;
        startValue?: number;
        endValue?: number;
        gradient?: string;
    };
    rotation?: { x?: number; y?: number; z?: number };
    position?: { x?: number; y?: number; z?: number };
    scale?: number;
    autoFit?: boolean;
    orbitControlsRef?: React.RefObject<any>;
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
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
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
    const storeActiveScenes = useEditorStore((state) => state.activeScenes);
    const plugins = usePluginStore((state) => state.plugins);

    const scenesToRender = useMemo(() => {
        return getRenderableScenes(storeActiveScenes, plugins, forceDefaultScene);
    }, [storeActiveScenes, plugins, forceDefaultScene]);

    const [modelHeights, setModelHeights] = React.useState<Record<number, number>>({});
    const [selectedModelIndex, setSelectedModelIndex] = React.useState<number | null>(null);

    const handleModelLoaded = React.useCallback((index: number, bounds: any) => {
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
                        key={`${scene.source}-${scene.sceneType}-${(scene as any).exposureId || ''}-${index}`}
                        trajectoryId={trajectoryId}
                        currentTimestep={currentTimestep}
                        analysisId={analysisId}
                        sceneConfig={scene as any}
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
