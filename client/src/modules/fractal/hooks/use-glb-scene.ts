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
import useThrottledCallback from '@/shared/presentation/hooks/use-throttled-callback';
import useModelInteraction from '@/modules/fractal/hooks/use-model-interaction';
import { createFractalEngine } from '@/modules/fractal/services/fractal-engine-factory';
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
        pointCloudSettings: params.pointCloudSettings
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
        sceneOpacities,
        activeModelBounds,
        onModelBoundsChanged,
        onLoadingStateChanged
    } = params;

    const engineRef = useRef<ReturnType<typeof createFractalEngine> | null>(null);

    const onModelBoundsChangedRef = useRef(onModelBoundsChanged);
    onModelBoundsChangedRef.current = onModelBoundsChanged;

    const onLoadingStateChangedRef = useRef(onLoadingStateChanged);
    onLoadingStateChangedRef.current = onLoadingStateChanged;

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

                    // Bump a lightweight generation counter so effects that
                    // depend on "has the model changed?" still fire, without
                    // putting the heavy Object3D into React state.
                    setModelGeneration((g) => g + 1);
                    invalidate();
                }
            }
        );

        if (engineParams.url) {
            engineRef.current.loadIfNeeded();
        }

        return () => {
            engineRef.current?.dispose();
            engineRef.current = null;
            // Ensure any model attached to the container is removed on unmount.
            if (modelRef.current) {
                modelRef.current.removeFromParent();
                modelRef.current = null;
            }
        };
    }, [scene, camera, gl, invalidate]);

    useEffect(() => {
        if (!engineRef.current) return;
        engineRef.current.setCamera(camera);
    }, [camera]);

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
        engineRef.current?.updateOpacity(params.sceneKey, sceneOpacities, pointCloudSettings);
    }, [modelGeneration, pointCloudSettings, sceneOpacities, params.sceneKey]);

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

    const updateScene = useCallback(() => {
        if (!engineRef.current) return;
        if (!params.url) return;
        engineRef.current.loadIfNeeded();
    }, [params.url]);

    const throttledUpdateScene = useThrottledCallback(updateScene, params.updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);

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
