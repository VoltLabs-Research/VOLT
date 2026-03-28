/**
 * Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import useModelInteraction from '@/modules/fractal/hooks/use-model-interaction';
import { createFractalEngine } from '@/modules/fractal/services/fractal-engine-factory';
import { debugFractal, warnFractal } from '@/modules/fractal/utilities/debug-log';
import type { ModelLoadingState, UseGlbSceneParams } from '@/modules/fractal/types';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { FractalParams } from '@/modules/fractal/services/fractal-engine';
import type { RefObject } from 'react';

function extractEngineParams(params: UseGlbSceneParams): FractalParams {
    return {
        url: params.url,
        sliceClippingPlanes: params.sliceClippingPlanes,
        position: params.position,
        rotation: params.rotation,
        scale: params.scale,
        updateThrottle: params.updateThrottle,
        disableAutoTransform: params.disableAutoTransform,
        useFixedReference: params.useFixedReference,
        onEmptyData: params.onEmptyData,
        sceneKey: params.sceneKey,
        boxBounds: params.boxBounds,
        pointCloudSettings: params.pointCloudSettings,
        dislocationLineSettings: params.dislocationLineSettings
    };
}

export default function useGlbScene(
    params: UseGlbSceneParams,
    /** Optional parent group ref. When provided the loaded model is attached
     *  imperatively via `parent.add(model)` instead of being returned as React
     *  state — this keeps the heavy 3D model out of React's reconciliation tree
     *  and eliminates re-renders when the model swaps. */
    modelContainerRef?: RefObject<THREE.Group | null>
) {
    const { scene, camera, gl, invalidate } = useThree();

    // Track the model imperatively — never store it in React state.
    // A generation counter is bumped whenever the model changes so that
    // downstream effects (point-cloud settings, opacity) still re-run.
    const modelRef = useRef<THREE.Object3D | null>(null);
    const [modelGeneration, setModelGeneration] = useState(0);
    const [modelBounds, setLocalModelBounds] = useState<BoundsInfo | null>(null);

    const {
        pointSizeMultiplier,
        pointCloudSettings,
        dislocationLineSettings,
        sceneVisualOverrides,
        activeModelBounds,
        onModelBoundsChanged,
        onLoadingStateChanged,
        onContentTypeDetected
    } = params;

    const engineRef = useRef<ReturnType<typeof createFractalEngine> | null>(null);
    const lastLoggedUrlRef = useRef<string | null>(null);

    const onModelBoundsChangedRef = useRef(onModelBoundsChanged);
    onModelBoundsChangedRef.current = onModelBoundsChanged;

    const onLoadingStateChangedRef = useRef(onLoadingStateChanged);
    onLoadingStateChangedRef.current = onLoadingStateChanged;

    const onContentTypeDetectedRef = useRef(onContentTypeDetected);
    onContentTypeDetectedRef.current = onContentTypeDetected;

    const [loadingState, setLoadingState] = useState<ModelLoadingState>({
        isLoading: false,
        progress: 0,
        error: null
    });

    useEffect(() => {
        const engineParams = extractEngineParams(params);
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
                    onModelBoundsChangedRef.current?.(bounds);
                },
                onLoadingState: (state) => {
                    setLoadingState(state);
                    onLoadingStateChangedRef.current?.(state);
                },
                onContentTypeDetected: (info) => {
                    onContentTypeDetectedRef.current?.(info);
                },
                onModelAvailable: (modelObj) => {
                    const parent = modelContainerRef?.current;

                    // Remove previous model from its parent imperatively.
                    if (modelRef.current) {
                        modelRef.current.removeFromParent();
                    }

                    modelRef.current = modelObj;

                    if (modelObj && parent) {
                        parent.add(modelObj);
                    }

                    debugFractal('use-glb-scene.model-available', {
                        url: params.url,
                        attachedToContainer: Boolean(modelObj && parent),
                        parentChildren: parent?.children.length ?? 0,
                        modelChildren: modelObj?.children.length ?? 0
                    });

                    // Bump a lightweight generation counter so effects that
                    // depend on "has the model changed?" still fire, without
                    // putting the heavy Object3D into React state.
                    setModelGeneration((g) => g + 1);
                    invalidate();
                }
            }
        );

        return () => {
            engineRef.current?.dispose();
            engineRef.current = null;
            // Ensure any model attached to the container is removed on unmount.
            if (modelRef.current) {
                modelRef.current.removeFromParent();
                modelRef.current = null;
            }
        };
    }, [gl, invalidate, scene]);

    useEffect(() => {
        if (!engineRef.current) return;
        engineRef.current.setCamera(camera);
    }, [camera]);

    useEffect(() => {
        const modelObj = modelRef.current;
        const parent = modelContainerRef?.current;

        if (!modelObj || !parent || modelObj.parent === parent) {
            return;
        }

        parent.add(modelObj);
        debugFractal('use-glb-scene.model-attached', {
            url: params.url,
            sceneKey: params.sceneKey,
            parentChildren: parent.children.length,
            modelChildren: modelObj.children.length
        });
        invalidate();
    }, [invalidate, modelContainerRef, modelGeneration, params.sceneKey, params.url]);

    useEffect(() => {
        if (!params.url || lastLoggedUrlRef.current === params.url) {
            return;
        }

        lastLoggedUrlRef.current = params.url;
        debugFractal('use-glb-scene.url', {
            url: params.url,
            sceneKey: params.sceneKey
        });
    }, [params.sceneKey, params.url]);

    useEffect(() => {
        const engineParams = extractEngineParams(params);
        engineRef.current?.configure(engineParams);
    }, [
        params.url,
        params.sliceClippingPlanes,
        params.position?.x, params.position?.y, params.position?.z,
        params.rotation?.x, params.rotation?.y, params.rotation?.z,
        params.scale,
        params.updateThrottle,
        params.disableAutoTransform,
        params.useFixedReference,
        params.sceneKey,
        params.boxBounds,
        params.pointCloudSettings
    ]);

    useEffect(() => {
        engineRef.current?.updatePointCloudSettings(pointCloudSettings, pointSizeMultiplier);
        // modelGeneration replaces the old `model` dependency — fires whenever the
        // model reference changes without putting the Object3D into React state.
    }, [modelGeneration, pointCloudSettings, pointSizeMultiplier]);

    useEffect(() => {
        engineRef.current?.updateOpacity(params.sceneKey, sceneVisualOverrides, pointCloudSettings);
    }, [modelGeneration, pointCloudSettings, sceneVisualOverrides, params.sceneKey]);

    useEffect(() => {
        engineRef.current?.updateDislocationLineWidth(dislocationLineSettings);
    }, [
        modelGeneration,
        dislocationLineSettings?.baseLineWidth,
        dislocationLineSettings?.lineWidth
    ]);

    // Update point cloud cameraPosition uniform each rendered frame.
    // With frameloop="demand" this only runs when a frame is already being
    // produced (orbit, model load, etc.), so it adds zero continuous cost.
    useFrame(({ camera }) => {
        engineRef.current?.updateCameraPosition(camera.position);
    });

    const interaction = useModelInteraction({
        onSelect: params.onSelect,
        onInvalidate: invalidate
    });

    const lastUpdateSceneCallRef = useRef(0);
    const updateSceneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateScene = useCallback(() => {
        if (!engineRef.current) return;
        if (!params.url) return;
        engineRef.current.loadIfNeeded();
    }, [params.url]);

    const throttledUpdateScene = useCallback(() => {
        const now = Date.now();
        const elapsed = now - lastUpdateSceneCallRef.current;

        if (elapsed >= params.updateThrottle) {
            lastUpdateSceneCallRef.current = now;
            updateScene();
            return;
        }

        if (updateSceneTimeoutRef.current) {
            clearTimeout(updateSceneTimeoutRef.current);
        }

        updateSceneTimeoutRef.current = setTimeout(() => {
            lastUpdateSceneCallRef.current = Date.now();
            updateScene();
        }, params.updateThrottle - elapsed);
    }, [params.updateThrottle, updateScene]);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);

    useEffect(() => {
        if (!loadingState.error) {
            return;
        }

        warnFractal('use-glb-scene.load-error', {
            url: params.url,
            sceneKey: params.sceneKey,
            error: loadingState.error
        });
    }, [loadingState.error, params.sceneKey, params.url]);

    useEffect(() => {
        return () => {
            if (updateSceneTimeoutRef.current) {
                clearTimeout(updateSceneTimeoutRef.current);
            }
        };
    }, []);

    return {
        modelBounds: modelBounds ?? activeModelBounds,
        isLoading: loadingState.isLoading,
        loadProgress: loadingState.progress,
        loadError: loadingState.error,
        isSelected: interaction.isSelected,
        isHovered: interaction.isHovered,
        resetModel: interaction.resetTransform,
        deselect: interaction.deselect,
        rotateXNegative: interaction.rotateXNegative,
        rotateXPositive: interaction.rotateXPositive,
        rotateYNegative: interaction.rotateYNegative,
        rotateYPositive: interaction.rotateYPositive,
        rotateZNegative: interaction.rotateZNegative,
        rotateZPositive: interaction.rotateZPositive,
        setSelectedObject: interaction.setSelectedObject,
        onHoverChange: interaction.onHoverChange
    };
}
