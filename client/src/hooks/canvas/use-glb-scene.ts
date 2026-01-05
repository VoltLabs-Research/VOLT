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
import { Raycaster, Plane, Vector3, Euler } from 'three';
import type { ExtendedSceneState, UseGlbSceneParams } from '@/types/canvas';
import useLogger from '@/hooks/core/use-logger';
import { useEditorStore } from '@/stores/slices/editor';
import ClippingManager from '@/utilities/glb/scene/clipping-manager';
import ReferencePointManager from '@/utilities/glb/scene/reference-point-manager';
import SelectionManager from '@/utilities/glb/scene/selection-manager';
import TransformationManager from '@/utilities/glb/scene/transformation-manager';
import ResourceManager from '@/utilities/glb/scene/resource-manager';
import ModelSetupManager from '@/utilities/glb/scene/model-setup-manager';
import ModelLoader from '@/utilities/glb/scene/model-loader';
import AnimationController from '@/utilities/glb/scene/animation-controller';
import InteractionController from '@/utilities/glb/scene/interaction-controllers';
import useThrottledCallback from '@/hooks/ui/use-throttled-callback';


export default function useGlbScene(params: UseGlbSceneParams) {
    const { scene, camera, gl, invalidate } = useThree();
    const logger = useLogger('use-glb-scene');

    const activeModel = useEditorStore((s) => s.activeModel);
    const setModelBounds = useEditorStore((s) => s.setModelBounds);
    const setIsModelLoading = useEditorStore((s) => s.setIsModelLoading);
    const pointSizeMultiplier = useEditorStore((s) => s.pointSizeMultiplier);

    const stateRef = useRef<ExtendedSceneState>({
        model: null,
        mesh: null,
        isSetup: false,
        lastLoadedUrl: null,
        failedUrls: new Set<string>(),
        isLoadingUrl: false,
        dragging: false,
        selected: null,
        selection: null,
        isSelectedPersistent: false,
        targetPosition: null,
        showSelection: false,
        isHovered: false,
        targetRotation: null,
        currentRotation: new Euler(0, 0, 0),
        targetScale: 1,
        currentScale: 1,
        modelBounds: null,
        lastInteractionTime: 0,
        simBoxMesh: null,
        simBoxSize: null,
        simBoxBaseSize: null,
        isRotating: false,
        rotationFreezeSize: null,
        lastRotationActiveMs: 0,
        sizeAnimActive: false,
        sizeAnimFrom: null,
        sizeAnimTo: null,
        sizeAnimStartMs: 0,
        referenceScaleFactor: undefined,
        fixedReferencePoint: null,
        useFixedReference: false,
        initialTransform: null,
    });

    const [loadingState, setLoadingState] = useState({
        isLoading: false,
        progress: 0,
        error: null as null | string
    });

    const raycaster = useRef(new Raycaster()).current;
    const groundPlane = useRef(new Plane(new Vector3(0, 0, 1), 0));

    // Initialize managers
    const clippingManager = useRef(new ClippingManager(gl, invalidate)).current;
    const referenceManager = useRef(new ReferencePointManager(stateRef.current)).current;
    const selectionManager = useRef(new SelectionManager(stateRef.current, scene, invalidate)).current;
    const transformManager = useRef(new TransformationManager(stateRef.current)).current;
    const resourceManager = useRef(new ResourceManager(stateRef.current, scene, invalidate)).current;

    const modelSetupManager = useRef(
        new ModelSetupManager(
            stateRef.current,
            params,
            clippingManager,
            referenceManager,
            transformManager,
            setModelBounds,
            invalidate
        )
    ).current;

    const modelLoader = useRef(
        new ModelLoader(
            stateRef.current,
            scene,
            resourceManager,
            modelSetupManager,
            setIsModelLoading,
            invalidate,
            logger,
            setLoadingState
        )
    ).current;

    const animationController = useRef(
        new AnimationController(stateRef.current, scene, camera, invalidate)
    ).current;

    const interactionController = useRef(
        new InteractionController(
            stateRef.current,
            camera,
            scene,
            gl,
            raycaster,
            groundPlane.current,
            selectionManager,
            transformManager,
            undefined,
            undefined,
            params.onSelect,
            params.orbitControlsRef
        )
    ).current;

    useEffect(() => {
        return () => {
            resourceManager.cleanup();
        };
    }, [resourceManager]);

    useEffect(() => {
        interactionController.setCamera(camera);
        interactionController.attach();
        return () => interactionController.detach();
    }, [interactionController, camera]);

    useFrame(() => {
        animationController.update();
    });

    useEffect(() => {
        if (!gl) return;
        clippingManager.setLocalClippingEnabled((params.sliceClippingPlanes?.length ?? 0) > 0);
    }, [gl, params.sliceClippingPlanes, clippingManager]);

    useEffect(() => {
        if (!stateRef.current.isSetup || !stateRef.current.model) return;
        clippingManager.applyToModel(stateRef.current.model, params.sliceClippingPlanes);
        invalidate();
    }, [params.sliceClippingPlanes, invalidate, clippingManager]);

    useEffect(() => {
        modelSetupManager.updateParams(params);
    }, [params, modelSetupManager]);

    useEffect(() => {
        if (!stateRef.current.model) return;
        const x = params.position?.x || 0;
        const y = params.position?.y || 0;
        const z = params.position?.z || 0;

        transformManager.setPosition(x, y, z);
        invalidate();
    }, [params.position?.x, params.position?.y, params.position?.z, transformManager, invalidate, loadingState.isLoading]);

    useEffect(() => {
        const mesh = stateRef.current.mesh;
        if (!mesh || !(mesh instanceof THREE.Points) || !mesh.material) return;

        const mat = mesh.material as THREE.ShaderMaterial;
        const baseScale = mat.userData.basePointScale;

        if (baseScale !== undefined) {
            mat.uniforms.pointScale.value = baseScale * pointSizeMultiplier;
            invalidate();
        }
    }, [pointSizeMultiplier, invalidate, loadingState.isLoading]);

    const getTargetUrl = useCallback((): string | null => {
        return params.url ?? null;
    }, [params.url]);

    const updateScene = useCallback(() => {
        const targetUrl = getTargetUrl();
        if (targetUrl &&
            targetUrl !== stateRef.current.lastLoadedUrl &&
            !modelLoader.isLoading()) {
            modelLoader.load(targetUrl, params.onEmptyData);
        }
    }, [getTargetUrl, modelLoader, params.onEmptyData]);

    const throttledUpdateScene = useThrottledCallback(updateScene, params.updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);

    return {
        meshRef: { current: stateRef.current.mesh },
        modelBounds: activeModel?.modelBounds,
        isLoading: loadingState.isLoading,
        loadProgress: loadingState.progress,
        loadError: loadingState.error,
        isSelected: stateRef.current.isSelectedPersistent,
        isHovered: stateRef.current.isHovered,
        resetModel: useCallback(() => {
            transformManager.reset();
        }, [transformManager]),
        clearCache: useCallback(() => {
            resourceManager.cleanup();
        }, [resourceManager]),
        deselect: useCallback(() => {
            selectionManager.deselect();
        }, [selectionManager])
    };
}
