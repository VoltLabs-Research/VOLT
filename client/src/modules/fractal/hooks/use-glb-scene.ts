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
import type { UseGlbSceneParams } from '@/modules/fractal/types';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/model';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
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

/**
 * useGlbScene — imperatively manages a FractalEngine and attaches the loaded
 * model to a ref-owned Group. Mutations flow through the engine's imperative
 * API; React re-renders are avoided for all hot-path updates (uniforms,
 * visibility mask, color coding).
 */
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
            { scene, camera, gl, invalidate },
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
                    // Apply settings imperatively on the new model.
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
                        engine.updateDislocationLineWidth(paramsRef.current.dislocationLineSettings);
                    }
                    invalidate();
                }
            }
        );

        // Why: React Strict Mode (and any future deps change on this effect)
        // will dispose the engine above and recreate it here. The load-trigger
        // effect below is keyed on (updateThrottle, updateScene) — both stay
        // the same across the double-mount, so it would not re-fire and the
        // fresh engine would never receive `loadIfNeeded()`. Kick off the
        // load explicitly during creation so the pipeline is always primed.
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

    // Single config effect — fires on primitive deps only to avoid re-running
    // on every render. paramsRef gives the effect the latest full params.
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
        engine.updateDislocationLineWidth(paramsRef.current.dislocationLineSettings);
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
        params.dislocationLineSettings
    ]);

    useFrame(({ camera: frameCamera }) => {
        engineRef.current?.updateCameraPosition(frameCamera.position);
    });

    const interaction = useModelInteraction({
        onSelect: params.onSelect,
        onInvalidate: invalidate
    });

    // Integrate load throttling with rAF — Why: the previous setTimeout-based
    // throttle competed with R3F's frame loop. We now request a load and rely
    // on the engine's internal abort/generation logic to coalesce.
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
