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
import { useThree } from '@react-three/fiber';
import type { ModelLoadingState, UseGlbSceneParams } from '@/modules/fractal/types';
import useThrottledCallback from '@/shared/presentation/hooks/use-throttled-callback';
import { type FractalParams } from '@/modules/fractal/services/fractal-engine';
import useModelInteraction from '@/modules/fractal/hooks/use-model-interaction';
import type { BoundsInfo } from '@/modules/fractal/core/model-transform';
import { createFractalEngine } from '@/modules/fractal/services/fractal-engine-factory';

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
        boxBounds: params.boxBounds
    };
}

export default function useGlbScene(params: UseGlbSceneParams) {
    const { scene, camera, gl, invalidate } = useThree();

    const [model, setModel] = useState<THREE.Object3D | null>(null);
    const [modelBounds, setLocalModelBounds] = useState<BoundsInfo | null>(null);

    const {
        pointSizeMultiplier,
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
            { scene, camera, gl, invalidate },
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
                onModelAvailable: (modelObj) => setModel(modelObj)
            }
        );

        if (engineParams.url) {
            engineRef.current.loadIfNeeded();
        }

        return () => {
            engineRef.current?.dispose();
            engineRef.current = null;
        };
    }, [scene, camera, gl, invalidate]);

    useEffect(() => {
        if (!engineRef.current) return;
        engineRef.current.setCamera(camera);
    }, [camera]);

    useEffect(() => {
        const engineParams = extractEngineParams(params);
        engineRef.current?.configure(engineParams);
    }, [params]);

    useEffect(() => {
        engineRef.current?.updatePointSize(pointSizeMultiplier);
    }, [model, pointSizeMultiplier]);

    useEffect(() => {
        engineRef.current?.updateOpacity(params.sceneKey, sceneOpacities);
    }, [model, sceneOpacities, params.sceneKey]);

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
        model,
        modelBounds: modelBounds ?? activeModelBounds,
        isLoading: loadingState.isLoading,
        loadProgress: loadingState.progress,
        loadError: loadingState.error,
        isSelected: interaction.isSelected,
        isHovered: interaction.isHovered,
        resetModel: interaction.resetTransform,
        deselect: interaction.deselect,
        setSelectedObject: interaction.setSelectedObject,
        onHoverChange: interaction.onHoverChange
    };
}
