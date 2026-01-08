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
import type { ExtendedSceneState, UseGlbSceneParams } from '@/features/canvas/types';
import useLogger from '@/hooks/core/use-logger';
import { useEditorStore } from '@/features/canvas/stores/editor';
import ClippingManager from '@/features/canvas/utilities/scene/clipping-manager';
import ReferencePointManager from '@/features/canvas/utilities/scene/reference-point-manager';
import SelectionManager from '@/features/canvas/utilities/scene/selection-manager';
import TransformationManager from '@/features/canvas/utilities/scene/transformation-manager';
import ResourceManager from '@/features/canvas/utilities/scene/resource-manager';
import ModelSetupManager from '@/features/canvas/utilities/scene/model-setup-manager';
import ModelLoader from '@/features/canvas/utilities/scene/model-loader';
import AnimationController from '@/features/canvas/utilities/scene/animation-controller';
import InteractionController from '@/features/canvas/utilities/scene/interaction-controllers';
import useThrottledCallback from '@/hooks/ui/use-throttled-callback';

export default function useGlbScene(params: UseGlbSceneParams) {
    const { scene, camera, gl, invalidate } = useThree();
    const logger = useLogger('use-glb-scene');

    // State to hold the current model for declarative rendering
    const [model, setModel] = useState<THREE.Object3D | null>(null);

    const activeModel = useEditorStore((s) => s.activeModel);
    const setModelBounds = useEditorStore((s) => s.setModelBounds);
    const setIsModelLoading = useEditorStore((s) => s.setIsModelLoading);
    const pointSizeMultiplier = useEditorStore((s) => s.pointSizeMultiplier);
    const sceneOpacities = useEditorStore((s) => s.sceneOpacities);

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
            setLoadingState,
            setModel
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
        if (params.disableAutoTransform) return;

        const x = params.position?.x || 0;
        const y = params.position?.y || 0;
        const z = params.position?.z || 0;

        transformManager.setPosition(x, y, z);
        invalidate();
    }, [params.position?.x, params.position?.y, params.position?.z, params.disableAutoTransform, transformManager, invalidate, loadingState.isLoading]);

    useEffect(() => {
        const mesh = stateRef.current.mesh;
        if (!mesh || !(mesh instanceof THREE.Points) || !mesh.material) return;

        const mat = mesh.material as THREE.ShaderMaterial;
        let baseScale = mat.userData.basePointScale;

        // If boxBounds available, use accurate simulation cell volume for density calculation
        if (params.boxBounds) {
            const { xlo, xhi, ylo, yhi, zlo, zhi } = params.boxBounds;
            const width = xhi - xlo;
            const height = yhi - ylo;
            const depth = zhi - zlo;
            const volume = width * height * depth;
            const numPoints = mesh.geometry.attributes.position.count;

            if (volume > 0 && numPoints > 0) {
                // spacing = (V/N)^(1/3)
                const spacing = Math.pow(volume / numPoints, 1.0 / 3.0);
                // consistent factor with materials.ts
                baseScale = spacing * 1.5;
            }
        }

        const normScale = params.normalizationScale || 1;

        if (baseScale !== undefined) {
            mat.uniforms.pointScale.value = baseScale * normScale * pointSizeMultiplier;
            invalidate();
        }
    }, [pointSizeMultiplier, params.boxBounds, params.normalizationScale, invalidate, loadingState.isLoading]);

    // Apply opacity from scene settings
    useEffect(() => {
        if (!model || !params.sceneKey) return;

        const opacity = sceneOpacities[params.sceneKey] ?? 1.0;

        model.traverse((child) => {
            if (child instanceof THREE.Points && child.material) {
                // Handle point cloud with ShaderMaterial
                const mat = child.material as THREE.ShaderMaterial;
                if (mat.uniforms?.opacity) {
                    mat.uniforms.opacity.value = opacity;
                }
            } else if (child instanceof THREE.Mesh && child.material) {
                // Handle mesh with MeshStandardMaterial or similar
                const mat = child.material as THREE.Material;
                mat.transparent = opacity < 1.0;
                mat.opacity = opacity;
                mat.needsUpdate = true;
            }
        });

        invalidate();
    }, [model, sceneOpacities, params.sceneKey, invalidate]);

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
        model,
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
        }, [selectionManager]),
        setSimBoxMesh: useCallback((mesh: THREE.Mesh | null) => {
            console.log('[useGlbScene] setSimBoxMesh', { mesh: !!mesh });
            stateRef.current.simBoxMesh = mesh;
            if (mesh) {
                // Ensure bounding box is computed
                if (!mesh.geometry.boundingBox) {
                    mesh.geometry.computeBoundingBox();
                }

                if (mesh.geometry.boundingBox) {
                    const size = new THREE.Vector3();
                    mesh.geometry.boundingBox.getSize(size);
                    stateRef.current.simBoxSize = size;
                    stateRef.current.simBoxBaseSize = size.clone();
                }
            } else {
                stateRef.current.simBoxSize = null;
                stateRef.current.simBoxBaseSize = null;
            }
        }, [])
    };
}
