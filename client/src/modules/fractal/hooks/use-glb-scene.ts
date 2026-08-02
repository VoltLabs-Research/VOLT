

import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import useModelInteraction from '@/modules/fractal/hooks/use-model-interaction';
import { createFractalEngine } from '@/modules/fractal/services/fractal-engine-factory';
import { debugFractal, warnFractal } from '@/modules/fractal/utils/debug-log';
import type { UseGlbSceneParams } from '@/modules/fractal/contracts';
import type { ModelLoadingState } from '@/modules/fractal/contracts/model';
import type { BoundsInfo } from '@/modules/fractal/utils/model-transform';
import type { FractalParams } from '@/modules/fractal/services/fractal-engine';
import type { RefObject } from 'react';

function extractEngineParams(params: UseGlbSceneParams): FractalParams {
    return {
        url: params.url,
        resourceKey: params.resourceKey,
        sliceClippingPlanes: params.sliceClippingPlanes,
        position: params.position,
        rotation: params.rotation,
        scale: params.scale,
        disableAutoTransform: params.disableAutoTransform,
        useFixedReference: params.useFixedReference,
        onEmptyData: params.onEmptyData,
        sceneKey: params.sceneKey,
        pointCloudSettings: params.pointCloudSettings,
        lineSettings: params.lineSettings,
        lineHighlight: params.lineHighlight
    };
}

export default function useGlbScene(
    params: UseGlbSceneParams,
    modelContainerRef?: RefObject<THREE.Group | null>
) {
    const { scene, camera, gl, invalidate } = useThree();

    const modelRef = useRef<THREE.Object3D | null>(null);
    const modelGenerationRef = useRef(0);
    const [modelBounds, setLocalModelBounds] = useState<BoundsInfo | null>(null);

    const engineRef = useRef<ReturnType<typeof createFractalEngine> | null>(null);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const [loadingState, setLoadingState] = useState<ModelLoadingState>({
        isLoading: false,
        progress: 0,
        error: null
    });

    useEffect(() => {
        const engineParams = extractEngineParams(paramsRef.current);
        engineRef.current = createFractalEngine(
            {
                scene,
                camera,
                gl,
                invalidate
            },
            engineParams,
            {
                onModelLoaded: (bounds) => {
                    setLocalModelBounds(bounds);
                    paramsRef.current.onModelBoundsChanged?.(bounds);
                },
                onLoadingState: (state) => {
                    setLoadingState(state);
                    paramsRef.current.onLoadingStateChanged?.(state);
                },
                onContentTypeDetected: (info) => {
                    paramsRef.current.onContentTypeDetected?.(info);
                },
                onModelAvailable: (modelObj) => {
                    const parent = modelContainerRef?.current;
                    if (modelRef.current) {
                        modelRef.current.removeFromParent();
                    }
                    modelRef.current = modelObj;
                    if (modelObj && parent) {
                        parent.add(modelObj);
                    }
                    debugFractal('use-glb-scene.model-available', {
                        url: paramsRef.current.url,
                        attachedToContainer: Boolean(modelObj && parent),
                        parentChildren: parent?.children.length ?? 0,
                        modelChildren: modelObj?.children.length ?? 0
                    });
                    modelGenerationRef.current += 1;
                    const engine = engineRef.current;
                    if (engine) {
                        engine.updatePointCloudSettings(
                            paramsRef.current.pointCloudSettings,
                            paramsRef.current.pointCloudSettings?.pointSizeMultiplier ?? 1
                        );
                        engine.updateOpacity(
                            paramsRef.current.sceneKey,
                            paramsRef.current.sceneVisualOverrides,
                            paramsRef.current.pointCloudSettings
                        );
                        engine.updateSceneColor(
                            paramsRef.current.sceneKey,
                            paramsRef.current.sceneVisualOverrides
                        );
                        engine.updateLineWidth(paramsRef.current.lineSettings);
                        engine.updateLineHighlight(paramsRef.current.lineHighlight);
                        engine.setVisibilityMask(paramsRef.current.visibilityMask ?? null);
                        engine.setSelectionHighlight(
                            paramsRef.current.selectionHighlightMask ?? null,
                            paramsRef.current.selectionHighlightColor ?? null
                        );
                    }
                    invalidate();
                }
            }
        );

        if (paramsRef.current.url) {
            engineRef.current.loadIfNeeded();
        }

        return () => {
            engineRef.current?.dispose();
            engineRef.current = null;
            if (modelRef.current) {
                modelRef.current.removeFromParent();
                modelRef.current = null;
            }
        };
    }, [gl, invalidate, scene, camera, modelContainerRef]);

    useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.setCamera(camera);
    }, [camera]);

    useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.configure(extractEngineParams(paramsRef.current));
        engine.updatePointCloudSettings(
            paramsRef.current.pointCloudSettings,
            paramsRef.current.pointCloudSettings?.pointSizeMultiplier ?? paramsRef.current.pointSizeMultiplier
        );
        engine.updateOpacity(
            paramsRef.current.sceneKey,
            paramsRef.current.sceneVisualOverrides,
            paramsRef.current.pointCloudSettings
        );
        engine.updateSceneColor(
            paramsRef.current.sceneKey,
            paramsRef.current.sceneVisualOverrides
        );
        engine.updateLineWidth(paramsRef.current.lineSettings);
        engine.updateLineHighlight(paramsRef.current.lineHighlight);
    }, [
        params.url,
        params.resourceKey,
        params.sliceClippingPlanes,
        params.position.x, params.position.y, params.position.z,
        params.rotation.x, params.rotation.y, params.rotation.z,
        params.scale,
        params.updateThrottle,
        params.disableAutoTransform,
        params.useFixedReference,
        params.sceneKey,
        params.boxBounds,
        params.pointCloudSettings,
        params.pointSizeMultiplier,
        params.sceneVisualOverrides,
        params.lineSettings,
        params.lineHighlight
    ]);

    useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.setVisibilityMask(params.visibilityMask ?? null);
    }, [params.visibilityMask]);

    useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.setSelectionHighlight(
            params.selectionHighlightMask ?? null,
            params.selectionHighlightColor ?? null
        );
    }, [params.selectionHighlightMask, params.selectionHighlightColor]);

    useFrame(({ camera: frameCamera }) => {
        engineRef.current?.updateCameraPosition(frameCamera.position);
    });

    const interaction = useModelInteraction({
        onSelect: params.onSelect,
        onInvalidate: invalidate
    });

    const pendingLoadRef = useRef<number | null>(null);
    const lastLoadRequestRef = useRef(0);
    const updateScene = useCallback(() => {
        if (!engineRef.current) return;
        if (!params.url) return;
        engineRef.current.loadIfNeeded();
    }, [params.url]);

    useEffect(() => {
        if (pendingLoadRef.current !== null) {
            cancelAnimationFrame(pendingLoadRef.current);
            pendingLoadRef.current = null;
        }
        const now = performance.now();
        const elapsed = now - lastLoadRequestRef.current;
        const schedule = () => {
            pendingLoadRef.current = null;
            lastLoadRequestRef.current = performance.now();
            updateScene();
        };
        if (elapsed >= params.updateThrottle) {
            schedule();
            return;
        }
        pendingLoadRef.current = requestAnimationFrame(() => {
            pendingLoadRef.current = requestAnimationFrame(schedule);
        });
        return () => {
            if (pendingLoadRef.current !== null) {
                cancelAnimationFrame(pendingLoadRef.current);
                pendingLoadRef.current = null;
            }
        };
    }, [params.resourceKey, params.updateThrottle, updateScene]);

    useEffect(() => {
        if (!loadingState.error) return;
        warnFractal('use-glb-scene.load-error', {
            url: params.url,
            sceneKey: params.sceneKey,
            error: loadingState.error
        });
    }, [loadingState.error, params.sceneKey, params.url]);

    return {
        modelBounds: modelBounds ?? params.activeModelBounds ?? null,
        loadError: loadingState.error,
        deselect: interaction.deselect,
        setSelectedObject: interaction.setSelectedObject,
        onHoverChange: interaction.onHoverChange
    };
}
