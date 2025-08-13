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

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, Mesh, Box3, BufferGeometry, Material, Vector3, Color } from 'three';
import { calculateModelBounds, calculateOptimalTransforms, getOptimizedMaterial } from '@/utilities/glb/modelUtils';
import { GLB_CONSTANTS, loadGLB, preloadGLBs } from '@/utilities/glb/loader';
import useThrottledCallback from '@/hooks/ui/use-throttled-callback';
import useConfigurationStore from '@/stores/editor/configuration';
import useTimestepStore from '@/stores/editor/timesteps';
import useLogger from '@/hooks/core/use-logger';
import MemoryManager from '@/utilities/memoryManager';
import CullingService from '@/services/culling-service';
import InstancedMeshManager from '@/services/instanced-mesh-manager';
import ObjectPools from '@/utilities/glb/objectPools';
import { useTime } from 'framer-motion';

export const modelCache = new Map<string, Promise<any>>();

export const useGlbScene = ({
    currentGlbUrl: propCurrentGlbUrl,
    nextGlbUrl: propNextGlbUrl,
    sliceClippingPlanes,
    position,
    rotation,
    scale,
    enableInstancing,
    onGeometryReady,
    updateThrottle,
}: any) => {
    const { scene, camera, invalidate } = useThree();
    const logger = useLogger('use-glb-scene');
    const activeSceneObject = useConfigurationStore((state) => state.activeSceneObject);
    const setIsModelLoading = useConfigurationStore((state) => state.setIsModelLoading);
    const storeCurrentGlbUrl = useTimestepStore((state) => state.currentGlbUrl);
    const storeNextGlbUrl = useTimestepStore((state) => state.nextGlbUrl);

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

    const materialCache = useMemo(() => new Map<string, Material>(), []);
    const geometryCache = useMemo(() => new Map<string, BufferGeometry>(), []);
    const memoryManager = useMemo(() => MemoryManager.getInstance(), []);

    const cullingService = useMemo(() => {
        return new CullingService((visibleIndice, lodLevel) => {
            stateRef.current.getVisibleIndices = visibleIndice;
            instancedMeshManager.markLODUpdateNeeded();
            invalidate();
        });
    }, [invalidate]);

    const instancedMeshManager = useMemo(() => {
        return new InstancedMeshManager(scene);
    }, [scene]);

    const getTargetUrl = useCallback((): string | null => {
        const glbUrl = propCurrentGlbUrl || storeCurrentGlbUrl;
        if(!glbUrl || !activeSceneObject){
            return null;
        }

        return glbUrl[activeSceneObject];
    }, [propCurrentGlbUrl, storeCurrentGlbUrl, activeSceneObject]);

    const handleModelPreloading = useCallback(() => {
        const preloadUrls = [
            propCurrentGlbUrl?.dislocations || storeCurrentGlbUrl?.dislocations,
            propNextGlbUrl?.dislocations || storeNextGlbUrl?.dislocations,
            (propNextGlbUrl || storeNextGlbUrl)?.[activeSceneObject],
        ].filter(Boolean);

        if(preloadUrls.length > 0){
            preloadGLBs(preloadUrls);
        }
    }, [propCurrentGlbUrl, propNextGlbUrl, storeCurrentGlbUrl, storeNextGlbUrl, activeSceneObject]);

    const cleanupResources = useCallback(() => {
        if(stateRef.current.cleanupScheduled) return;
        stateRef.current.cleanupScheduled = true;

        // Cleanup services
        cullingService.terminate();
        instancedMeshManager.cleanup();

        // Remove models from scene
        scene.children.forEach((child: any) => {
            if(child.userData.glbUrl && child instanceof Group){
                scene.remove(child);
            }
        });

        // Reset state
        stateRef.current.model = null;
        stateRef.current.mesh = null;
        stateRef.current.atoms = [];
        stateRef.current.visibleIndices.clear();
        stateRef.current.isSetup = false;
        stateRef.current.cleanupScheduled = false;

        invalidate();
    }, [scene, invalidate, cullingService, instancedMeshManager]);

    const processAtomData = useCallback((model: Group, optimalScale: number): number => {
        const positionsArray = new Float32Array(GLB_CONSTANTS.MAX_VISIBLE_INSTANCES * 3);
        const colorsArray = new Float32Array(GLB_CONSTANTS.MAX_VISIBLE_INSTANCES * 3);
        const sizesArray = new Float32Array(GLB_CONSTANTS.MAX_VISIBLE_INSTANCES);
        let atomCount = 0;

        model.traverse((child) => {
            if(child instanceof Mesh && atomCount <= GLB_CONSTANTS.MAX_VISIBLE_INSTANCES){
                const positions = child.geometry.attributes.position;
                const colors = child.geometry.attributes.color;

                if(positions){
                    const posArray = positions.array as Float32Array;
                    const colorArray = colors?.array as Float32Array;

                    for(let i = 0; i < posArray.length; i += 3){
                        if(atomCount >= GLB_CONSTANTS.MAX_VISIBLE_INSTANCES) break;
                        if(isNaN(posArray[i]) || isNaN(posArray[i + 1]) || isNaN(posArray[i + 2])) continue;

                        const idx = atomCount * 3;
                        positionsArray[idx] = posArray[i];
                        positionsArray[idx + 1] = posArray[i + 1];
                        positionsArray[idx + 2] = posArray[i + 2];
                        colorsArray[idx] = colorArray ? colorArray[i] : 1;
                        colorsArray[idx + 1] = colorArray ? colorArray[i + 1] : 1;
                        colorsArray[idx + 2] = colorArray ? colorArray[i + 2] : 1;
                        sizesArray[atomCount] = 0.1 * optimalScale;
                        atomCount++;
                    }
                }
            }
        });

        stateRef.current.atoms = Array.from({ length: atomCount }, (_, i) => ({
            position: new Vector3(positionsArray[i * 3], positionsArray[i * 3 + 1], positionsArray[i * 3 + 2]),
            color: new Color(colorsArray[i * 3], colorsArray[i * 3 + 1], colorsArray[i * 3 + 2]),
            size: sizesArray[i],
            visible: true,
            lodLevel: 1,
        }));

        cullingService.initializeAtoms(stateRef.current.atoms);
        logger.log(`Processed ${atomCount} atoms`);

        return atomCount;
    }, [logger, cullingService]);

    const adjustModelToGround = useCallback((model: Group) => {
        const finalBox = new Box3().setFromObject(model);
        const minZ = finalBox.min.z;
        if(minZ < 0){
            model.position.z += Math.abs(minZ);
        }
    }, []);

    const setupModel = useCallback((model: Group) => {
        if(stateRef.current.isSetup){
            return model;
        }

        const bounds = calculateModelBounds({ scene: model });
        const { position: optimalPos, rotation: optimalRot, scale: optimalScale } = calculateOptimalTransforms(bounds);

        let mainGeometry: BufferGeometry | null = null;
        let mainMaterial: Material | null = null;

        const isNonAtomistic = activeSceneObject === 'dislocations' || 
                           activeSceneObject === 'interface_mesh' || 
                           activeSceneObject === 'defect_mesh';

        model.traverse((child) => {
            if(child instanceof Mesh && !mainGeometry){
            mainGeometry = child.geometry;
                mainMaterial = child.material as Material;
                child.frustumCulled = true;
                
                if(enableInstancing && !isNonAtomistic){
                    child.visible = false;
                }else{
                    child.visible = true;
                    child.material = getOptimizedMaterial(child.material as Material, sliceClippingPlanes);
                }

                stateRef.current.mesh = child;
            }
        });

        if(mainGeometry && mainMaterial && enableInstancing && !isNonAtomistic){
            const atomCount = processAtomData(model, optimalScale);
            const optimizedMaterial = getOptimizedMaterial(mainMaterial, sliceClippingPlanes);
            optimizedMaterial.transparent = true;
            optimizedMaterial.opacity = 0.9;

            instancedMeshManager.createInstancedMeshes(mainGeometry, optimizedMaterial);
            onGeometryReady({
                geometry: mainGeometry,
                material: optimizedMaterial,
                instanceCount: atomCount
            });
        }

        // Set model transforms
        model.position.set(
            (position.x ?? GLB_CONSTANTS.DEFAULT_POSITION.x) + optimalPos.x,
            (position.y ?? GLB_CONSTANTS.DEFAULT_POSITION.y) + optimalPos.y,
            (position.z ?? GLB_CONSTANTS.DEFAULT_POSITION.z) + optimalPos.z
        );
        
        model.rotation.set(
            (rotation.x ?? GLB_CONSTANTS.DEFAULT_ROTATION.x) + optimalRot.x,
            (rotation.y ?? GLB_CONSTANTS.DEFAULT_ROTATION.y) + optimalRot.y,
            (rotation.z ?? GLB_CONSTANTS.DEFAULT_ROTATION.z) + optimalRot.z
        );
        
        model.scale.setScalar(scale * optimalScale);

        adjustModelToGround(model);
        model.updateMatrix();
        model.matrixAutoUpdate = true;

        setModelBounds(bounds);
        invalidate();

        stateRef.current.isSetup = true;
        return model;
    }, [
        processAtomData,
        instancedMeshManager,
        onGeometryReady,
        position,
        rotation,
        scale,
        sliceClippingPlanes,
        enableInstancing,
        adjustModelToGround,
        invalidate,
        activeSceneObject
    ]);

    const applyClippingPlanesToNode = useCallback((root: Group, planes: Plane[]) => {
        root.traverse((child: any) => {
            if(child.isMesh && child.material){
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                for(const m of mats){
                    m.clippingPlanes = planes;
                    m.clipIntersection = true;
                    m.needsUpdate = true;
                }
            }
        });
    }, []);

    useEffect(() => {
        const model = stateRef.current.model as Group | null;
        if (model) {
            applyClippingPlanesToNode(model, sliceClippingPlanes);
        }
    }, [sliceClippingPlanes, applyClippingPlanesToNode]);

    const loadAndSetupModel = useCallback(async (url: string) => {
        if(stateRef.current.lastLoadedUrl === url || loadingState.isLoading) return;

        const controller = new AbortController();
        setIsModelLoading(true);
        setLoadingState({ isLoading: true, progress: 0, error: null });

        try{
            if(!memoryManager.canLoadModel()){
                // TODO: CHANGETHIS TO OPTIONAL IN UI (MODIFIERS/OPTIONS)!
                // throw new Error('Insufficient memory for model loading');
            }

            const loadedModel = await loadGLB((url), (progress) => {
                setLoadingState((prev) => ({ ...prev, progress: Math.round(progress * 100) }));
            }, controller.signal);

            cleanupResources();

            const newModel = setupModel(loadedModel);
            newModel.userData.glbUrl = url;
            
            scene.add(newModel);
            stateRef.current.model = newModel;
            stateRef.current.lastLoadedUrl = url;

            handleModelPreloading();
            invalidate();

            setLoadingState({ isLoading: false, progress: 100, error: null });
        }catch(error){
            if(error instanceof Error && error.name === 'AbortError') return;

            const message = error instanceof Error ? error.message : String(error);
            setLoadingState({ isLoading: false, progress: 0, error: message });
            logger.error('Model loading failed:', message);
        }finally{
            setIsModelLoading(false);
        }

        return () => {
            controller.abort();
        }
    }, [
        scene,
        setupModel,
        setIsModelLoading,
        cleanupResources,
        handleModelPreloading,
        logger,
        invalidate,
        loadingState.isLoading,
        memoryManager
    ]);

    const performCulling = useCallback(() => {
        if(stateRef.current.atoms.length === 0) return;

        cullingService.performCulling(camera, stateRef.current.atoms);
        stateRef.current.lastCullFrame = stateRef.current.frameCount;
    }, [camera, cullingService]);

    const updateInstancedMeshes = useCallback(() => {
        instancedMeshManager.updateInstances(
        camera,
        stateRef.current.atoms,
        stateRef.current.visibleIndices,
        scale
        );
    }, [camera, instancedMeshManager, scale]);

    const updateScene = useCallback(() => {
        stateRef.current.frameCount++;

        const targetUrl = getTargetUrl();
        if(targetUrl && targetUrl !== stateRef.current.lastLoadedUrl && !loadingState.isLoading){
            loadAndSetupModel(targetUrl);
            return;
        }

        if(stateRef.current.frameCount - stateRef.current.lastCullFrame > GLB_CONSTANTS.CULL_FRAME_INTERVAL){
            performCulling();
        }

        if(stateRef.current.frameCount % 2 === 0){
            updateInstancedMeshes();
        }
    }, [getTargetUrl, loadingState.isLoading, loadAndSetupModel, performCulling, updateInstancedMeshes]);

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

        return () => {
            clearInterval(interval);
        };
    }, [throttledUpdateScene, loadingState.isLoading, updateThrottle]);

    useEffect(() => {
        
        return () => {
            logger.log('Unmounting useGlbScene');
            cleanupResources();
            materialCache.clear();
            geometryCache.clear();
            modelCache.clear();
            ObjectPools.cleanup();
        };
    }, [cleanupResources, materialCache, geometryCache, logger]);

    return {
        meshRef: { current: stateRef.current.mesh },
        modelBounds,
        isLoading: loadingState.isLoading,
        loadProgress: loadingState.progress,
        loadError: loadingState.error,

        memoryStats: { 
            usage: memoryManager.getMemoryUsage(),  
            canLoadModel: memoryManager.canLoadModel() 
        },
        
        atomCount: stateRef.current.atoms.length,
        visibleAtomCount: stateRef.current.visibleIndices.size,
        
        forceReload: useCallback(() => {
            stateRef.current.lastLoadedUrl = null;
            throttledUpdateScene();
        }, [throttledUpdateScene]),

        clearCache: useCallback(() => {
            cleanupResources();
            materialCache.clear();
            geometryCache.clear();
            modelCache.clear();
        }, [cleanupResources, materialCache, geometryCache]),
    };
};
