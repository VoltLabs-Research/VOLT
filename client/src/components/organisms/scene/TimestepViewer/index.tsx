import React, { useMemo, forwardRef, useImperativeHandle } from 'react';
import { useEditorStore } from '@/stores/slices/editor';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import SingleModelViewer from '@/components/molecules/scene/SingleModelViewer';

interface TimestepViewerProps {
    /** Trajectory ID - required for computing GLB URL */
    trajectoryId: string;
    /** Current timestep - required for computing GLB URL */
    currentTimestep: number | undefined;
    /** Analysis config ID - defaults to 'default' */
    analysisId?: string;
    /** Active scene configuration from store */
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
    /** Spacing between models when multiple are displayed */
    spacing?: number;
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
    spacing = 0.5
}, ref) => {
    // Get activeScenes from store
    const storeActiveScenes = useEditorStore((state) => state.activeScenes);
    const plugins = usePluginStore((state) => state.plugins);

    // Helper to check if a scene is a chart export (not a GLB)
    // Uses backend-computed exposures instead of workflow traversal
    const isChartScene = React.useCallback((scene: any) => {
        if (scene.source !== 'plugin') return false;
        const { exposureId } = scene;
        if (!exposureId) return false;

        for (const plugin of plugins) {
            if (!plugin.exposures) continue;
            const exposure = plugin.exposures.find(e => e._id === exposureId);
            if (exposure?.export?.type === 'chart-png') {
                return true;
            }
        }
        return false;
    }, [plugins]);

    // Filter out chart scenes (they're handled by CanvasWidgets, not as 3D models)
    const scenesToRender = useMemo(() => {
        return storeActiveScenes.filter(scene => !isChartScene(scene));
    }, [storeActiveScenes, isChartScene]);

    // Track the Y-dimensions of loaded models to position them correctly
    const [modelHeights, setModelHeights] = React.useState<Record<number, number>>({});
    // Track selected model index to enforce exclusive selection
    const [selectedModelIndex, setSelectedModelIndex] = React.useState<number | null>(null);

    const handleModelLoaded = React.useCallback((index: number, bounds: any) => {
        if (bounds?.size?.y) {
            setModelHeights(prev => {
                // Avoid unnecessary state updates
                if (Math.abs(prev[index] - bounds.size.y) < 0.01) return prev;
                return { ...prev, [index]: bounds.size.y };
            });
        }
    }, []);

    if (scenesToRender.length === 0) return null;

    let previousCenter = position.y || 0;
    let previousHalfHeight = 0;

    return (
        <>
            {scenesToRender.map((scene, index) => {
                const height = modelHeights[index] || 12; // Default to 12
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

                const scenePosition = {
                    ...position,
                    y: currentY
                };

                console.log('[TimestepViewer] Scene Layout', { index, currentY, height, padding });

                console.log(`[TimestepViewer] Scene ${index}`, scene);
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
                        // Only the first scene (or the one matching legacy activeScene) drives the camera
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
