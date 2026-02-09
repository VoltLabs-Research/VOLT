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
import type { UseGlbSceneParams } from '@/modules/fractal/presentation/types';
import useThrottledCallback from '@/shared/presentation/hooks/use-throttled-callback';
import { FractalEngine } from '@/modules/fractal/core/FractalEngine';

export default function useGlbScene(params: UseGlbSceneParams) {
    const { scene, camera, gl, invalidate } = useThree();

    const [model, setModel] = useState<THREE.Object3D | null>(null);
    const [modelBounds, setLocalModelBounds] = useState<any>(null);

    const {
        pointSizeMultiplier,
        sceneOpacities,
        activeModelBounds,
        onModelBoundsChanged,
        onLoadingStateChanged
    } = params;

    const engineRef = useRef<FractalEngine | null>(null);

    const onModelBoundsChangedRef = useRef(onModelBoundsChanged);
    onModelBoundsChangedRef.current = onModelBoundsChanged;

    const onLoadingStateChangedRef = useRef(onLoadingStateChanged);
    onLoadingStateChangedRef.current = onLoadingStateChanged;

    const [loadingState, setLoadingState] = useState({
        isLoading: false,
        progress: 0,
        error: null as null | string
    });

    useEffect(() => {
        engineRef.current = new FractalEngine(
            { scene, camera, gl, invalidate },
            params,
            {
                onModelLoaded: (bounds) => {
                    setLocalModelBounds(bounds as any);
                    onModelBoundsChangedRef.current?.(bounds as any);
                },
                onLoadingState: (state) => {
                    setLoadingState(state);
                    onLoadingStateChangedRef.current?.(state.isLoading);
                },
                onModelAvailable: (modelObj) => setModel(modelObj)
            }
        );

        return () => {
            engineRef.current?.dispose();
            engineRef.current = null;
        };
    }, [scene, camera, gl, invalidate]);

    useEffect(() => {
        if (!engineRef.current) return;
        engineRef.current.setCamera(camera);
        engineRef.current.attachEvents();
        return () => engineRef.current?.detachEvents();
    }, [camera]);

    useFrame(() => {
        engineRef.current?.tick();
    });

    useEffect(() => {
        engineRef.current?.configure(params);
    }, [params]);

    useEffect(() => {
        engineRef.current?.updatePointSize(pointSizeMultiplier, params.normalizationScale, params.boxBounds);
    }, [model, pointSizeMultiplier, params.boxBounds, params.normalizationScale]);

    useEffect(() => {
        engineRef.current?.updateOpacity(params.sceneKey, sceneOpacities);
    }, [model, sceneOpacities, params.sceneKey]);

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
        isSelected: engineRef.current?.isSelected() ?? false,
        isHovered: engineRef.current?.isHovered() ?? false,
        resetModel: useCallback(() => {
            engineRef.current?.resetTransform();
        }, []),
        clearCache: useCallback(() => {
            engineRef.current?.dispose();
        }, []),
        deselect: useCallback(() => {
            engineRef.current?.deselect();
        }, []),
        setSimBoxMesh: useCallback((mesh: THREE.Mesh | null) => {
            engineRef.current?.setSimBoxMesh(mesh);
        }, [])
    };
}
