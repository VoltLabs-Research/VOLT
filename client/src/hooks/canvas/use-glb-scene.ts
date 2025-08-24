/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
import { useThree, useFrame } from '@react-three/fiber';
import { Group, Mesh, Box3, BufferGeometry, Vector3, Points, ShaderMaterial } from 'three';
import { calculateModelBounds, calculateOptimalTransforms, getOptimizedMaterial } from '@/utilities/glb/modelUtils';
import { GLB_CONSTANTS, loadGLB, preloadGLBs } from '@/utilities/glb/loader';
import useThrottledCallback from '@/hooks/ui/use-throttled-callback';
import useTimestepStore from '@/stores/editor/timesteps';
import useLogger from '@/hooks/core/use-logger';

import vertexShader from '@/shaders/point-cloud.vert?raw';
import fragmentShader from '@/shaders/point-cloud.frag?raw';

export const useGlbScene = ({
    currentGlbUrl,
    nextGlbUrl,
    activeSceneObject,
    sliceClippingPlanes,
    position,
    rotation,
    scale,
    enableInstancing,
    updateThrottle,
}: any) => {
    const { scene, camera, invalidate } = useThree();
    const logger = useLogger('use-glb-scene');

    const stateRef = useRef<any & {
        frameCount: number;
        lastCullFrame: number;
        cleanupScheduled: boolean;
        lastCameraPosition: Vector3;
        visibleIndices: Set<number>;
    }>({
        model: null,
        mesh: null,
        atoms: [],
        isSetup: false,
        lastLoadedUrl: null,
        frameCount: 0,
        lastCullFrame: 0,
        cleanupScheduled: false,
        lastCameraPosition: new Vector3(),
        visibleIndices: new Set<number>(),
    });

    const modelBounds = useTimestepStore((state) => state.modelBounds);
    const setModelBounds = useTimestepStore((state) => state.setModelBounds);
    const [loadingState, setLoadingState] = useState({
        isLoading: false,
        progress: 0,
        error: null,
    });

    const getTargetUrl = useCallback((): string | null => {
        if(!currentGlbUrl || !activeSceneObject){
            return null;
        }

        return currentGlbUrl[activeSceneObject];
    }, [currentGlbUrl, activeSceneObject]);

    const handleModelPreloading = useCallback(() => {
        const preloadUrls = [
            currentGlbUrl?.dislocations ||
            nextGlbUrl?.dislocations
            (nextGlbUrl)?.[activeSceneObject],
        ].filter(Boolean);
        
        if(preloadUrls.length > 0){
            preloadGLBs(preloadUrls);
        }
    }, [currentGlbUrl, nextGlbUrl, activeSceneObject]);

    const cleanupResources = useCallback(() => {
        if(stateRef.current.cleanupScheduled) return;
        
        stateRef.current.cleanupScheduled = true;

        scene.children.forEach((child: any) => {
            if(child.userData.glbUrl && child instanceof Group){
                scene.remove(child);
            }
        });

        stateRef.current.model = null;
        stateRef.current.mesh = null;
        stateRef.current.atoms = [];
        stateRef.current.visibleIndices.clear();
        stateRef.current.isSetup = false;
        stateRef.current.cleanupScheduled = false;
        
        invalidate();
    }, [scene, invalidate]);

    const adjustModelToGround = useCallback((model: Group) => {
        const finalBox = new Box3().setFromObject(model);
        const minZ = finalBox.min.z;
        if(minZ < 0){
            model.position.z += Math.abs(minZ);
        }
    }, []);

    useFrame(() => {
        const mesh = stateRef.current.mesh;
        if(mesh && mesh instanceof Points && mesh.material instanceof ShaderMaterial){
            mesh.material.uniforms.cameraPosition.value.copy(camera.position);
        }
    });

    const configurePointCloudMaterial = useCallback((points: Points) => {
        const optimalRadius = points.userData.optimalRadius;
        const pointSize = optimalRadius * 0.1;

        points.material = new ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                pointScale: { value: pointSize * scale },
                cameraPosition: { value: new Vector3() },
                ambientFactor: { value: 0.15 },
                diffuseFactor: { value: 0.6 },
                specularFactor: { value: 0.5 },
                shininess: { value: 120.0 },
                rimFactor: { value: 0.1 },
                rimPower: { value: 3.0 },
            },
            vertexColors: true,
            transparent: true,
            depthWrite: true,
            depthTest: true,
            clipping: true,
        });

        stateRef.current.mesh = points;
    }, [scale]);

    const configureGeometry = useCallback((model: Group) => {
        let mainGeometry: BufferGeometry | null = null;

        model.traverse((child) => {
            if(child instanceof Mesh && !mainGeometry){
                mainGeometry = child.geometry;

                child.frustumCulled = true;
                child.visible = true;
                child.material = getOptimizedMaterial(child.material, sliceClippingPlanes);

                stateRef.current.mesh = child;
            }
        });
    }, [enableInstancing]);

    const isPointCloudObject = useCallback((model: Group) => {
        let pointCloudObject: Points | null = null;

        model.traverse((child) => {
            if(child instanceof Points){
                pointCloudObject = child;
            }
        });

        return pointCloudObject;
    }, []);

    const setupModel = useCallback((model: Group) => {
        if(stateRef.current.isSetup){
            return model;
        }

        const bounds = calculateModelBounds({ scene: model });
        const { position: optimalPos, rotation: optimalRot, scale: optimalScale } = calculateOptimalTransforms(bounds);

        // The visualization of atoms or the structural identification of a 
        // simulation frame are exported as a point cloud. 
        // The defect mesh, dislocations, and others are geometries.
        let pointCloudObject = isPointCloudObject(model);
        if(pointCloudObject){
            configurePointCloudMaterial(pointCloudObject);
        }else{
            configureGeometry(model);
        }

     
        model.scale.setScalar(scale * optimalScale);
        // adjustModelToGround(model);
        model.updateMatrixWorld(true);
        const finalBounds = calculateModelBounds({ scene: model });
        setModelBounds(finalBounds);
        invalidate();
        stateRef.current.isSetup = true;
        return model;
    }, [
        camera,
        position,
        rotation,
        scale,
        sliceClippingPlanes,
        enableInstancing,
        adjustModelToGround,
        invalidate,
        activeSceneObject
    ]);

    const applyClippingPlanesToNode = useCallback((root: Group, planes: any[]) => {
        root.traverse((child: any) => {
            if((child.isMesh || child.isPoints) && child.material){
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                for(const m of mats){
                    m.clippingPlanes = planes;
                    m.needsUpdate = true;
                }
            }
        });
    }, []);


    useEffect(() => {
        const model = stateRef.current.model as Group | null;
        if(model){
            applyClippingPlanesToNode(model, sliceClippingPlanes);
        }
    }, [sliceClippingPlanes, applyClippingPlanesToNode]);

    const loadAndSetupModel = useCallback(async (url: string) => {
        if(stateRef.current.lastLoadedUrl === url || loadingState.isLoading) return;

        const controller = new AbortController();
        // setIsModelLoading(true);
        setLoadingState({ isLoading: true, progress: 0, error: null });

        try{
            const loadedModel = await loadGLB((url), (progress) => {
                setLoadingState((prev) => ({ ...prev, progress: Math.round(progress * 100) }));
            }, /*controller.signal*/);

            cleanupResources();
            const newModel = setupModel(loadedModel);

            newModel.userData.glbUrl = url;
            scene.add(newModel);
            stateRef.current.model = newModel;
            stateRef.current.lastLoadedUrl = url;

            handleModelPreloading();
            invalidate();
            setLoadingState({ isLoading: false, progress: 100, error: null });

        }catch(error: any){
            if(error instanceof Error && error.name === 'AbortError') return;
            const message = error instanceof Error ? error.message : String(error);
            setLoadingState({ isLoading: false, progress: 0, error: null });
            logger.error('Model loading failed:', message);
        }finally{
            // setIsModelLoading(false);
        }
        
        return () => controller.abort();
    }, [
        scene,
        setupModel,
        // setIsModelLoading,
        cleanupResources,
        handleModelPreloading,
        logger,
        invalidate,
        loadingState.isLoading
    ]);

    const updateScene = useCallback(() => {
        stateRef.current.frameCount++;
        const targetUrl = getTargetUrl();
        if(targetUrl && targetUrl !== stateRef.current.lastLoadedUrl && !loadingState.isLoading){
            loadAndSetupModel(targetUrl);
            return;
        }
    }, [getTargetUrl, loadingState.isLoading, loadAndSetupModel]);

    const throttledUpdateScene = useThrottledCallback(updateScene, updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);

    useEffect(() => {
        const interval = setInterval(() => {
            if(stateRef.current.isSetup && !loadingState.isLoading){
                throttledUpdateScene();
            }
        }, updateThrottle);
        return () => clearInterval(interval);
    }, [throttledUpdateScene, loadingState.isLoading, updateThrottle]);

    useEffect(() => {
        return () => {
            logger.log('Unmounting useGlbScene');
            cleanupResources();
        };
    }, [cleanupResources, logger]);

    return {
        meshRef: { current: stateRef.current.mesh },
        modelBounds,
        isLoading: loadingState.isLoading,
        loadProgress: loadingState.progress,
        loadError: loadingState.error,
        forceReload: useCallback(() => {
            stateRef.current.lastLoadedUrl = null;
            throttledUpdateScene();
        }, [throttledUpdateScene]),
        clearCache: useCallback(() => {
            cleanupResources();
        }, [cleanupResources]),
    };
};