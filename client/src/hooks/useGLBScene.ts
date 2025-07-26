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
import { Group, Mesh, Box3, Object3D, BufferGeometry, Material, Plane } from 'three';
import { calculateModelBounds, calculateOptimalTransforms } from '@/utilities/glb/modelUtils';
import { getOptimizedMaterial } from '@/utilities/glb/modelUtils';
import useThrottledCallback from '@/hooks/useThrottledCallback';
import useEditorStore from '@/stores/editor';
import loadGLB, { preloadGLBs, modelCache } from '@/utilities/glb/loader';
import * as THREE from 'three';

interface UseGlbSceneProps {
    currentGlbUrl: any;
    nextGlbUrl: any;
    sliceClippingPlanes: Plane[];
    position: { x?: number; y?: number; z?: number };
    rotation: { x?: number; y?: number; z?: number };
    scale: number;
    enableInstancing: boolean;
    onGeometryReady: (data: { geometry: BufferGeometry; material: Material }) => void;
    updateThrottle: number;
}

const activeSceneObjectSelector = (state: any) => state.activeSceneObject;
const setIsModelLoadingSelector = (state: any) => state.setIsModelLoading;
const isModelLoadingSelector = (state: any) => state.isModelLoading;

export const useGlbScene = ({
    currentGlbUrl,
    nextGlbUrl,
    sliceClippingPlanes,
    position,
    rotation,
    scale,
    enableInstancing,
    onGeometryReady,
    updateThrottle,
}: UseGlbSceneProps) => {
    const { scene } = useThree();

    const activeSceneObject = useEditorStore(activeSceneObjectSelector);
    const setIsModelLoading = useEditorStore(setIsModelLoadingSelector);
    const isModelLoading = useEditorStore(isModelLoadingSelector);

    const modelRef = useRef<Group | null>(null);
    const meshRef = useRef<Mesh | undefined>(undefined);
    const materialCache = useRef(new Map<string, THREE.MeshStandardMaterial>());
    const lastLoadedUrl = useRef<string | null>(null);
    const loadingController = useRef<AbortController | null>(null);

    const [modelBounds, setModelBounds] = useState<ReturnType<typeof calculateModelBounds> | null>(null);

    const transformConfig = useMemo(() => ({
        position: { x: position.x || 0, y: position.y || 0, z: position.z || 0 },
        rotation: { x: rotation.x || 0, y: rotation.y || 0, z: rotation.z || 0 },
        scale
    }), [position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, scale]);

    const preloadUrls = useMemo(() => {
        const urls = [
            currentGlbUrl?.dislocations,
            nextGlbUrl?.dislocations,
            nextGlbUrl?.[activeSceneObject]
        ].filter(Boolean);
        
        return urls.length > 0 ? urls : null;
    }, [currentGlbUrl?.dislocations, nextGlbUrl?.dislocations, nextGlbUrl, activeSceneObject]);

    const applyOptimizations = useCallback((object: Object3D) => {
        let meshFound = false;
        
        object.traverse((child) => {
            if(child instanceof Mesh && child.geometry?.attributes?.position){
                child.frustumCulled = true;
                
                if(!meshFound && !meshRef.current){
                    meshRef.current = child;
                    meshFound = true;
                }

                if(enableInstancing){
                    onGeometryReady({ 
                        geometry: child.geometry, 
                        material: child.material as Material 
                    });
                    return;
                }

                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const optimizedMaterials: Material[] = [];
                let materialsChanged = false;

                materials.forEach((material, index) => {
                    if(material?.isMaterial){
                        const optimized = getOptimizedMaterial(
                            material, 
                            sliceClippingPlanes, 
                            materialCache.current
                        );

                        optimizedMaterials[index] = optimized;
                        if(optimized !== material){
                            materialsChanged = true;
                        }
                    }else{
                        optimizedMaterials[index] = material;
                    }
                });

                if(materialsChanged){
                    child.material = Array.isArray(child.material) 
                        ? optimizedMaterials 
                        : optimizedMaterials[0];
                }
            }
        });
    }, [sliceClippingPlanes, enableInstancing, onGeometryReady]);

    const updateSceneInternal = useCallback(async () => {
        if(!currentGlbUrl || !activeSceneObject || isModelLoading){
            return;
        }

        const targetUrl = currentGlbUrl[activeSceneObject];
        if(!targetUrl){
            return;
        }

        if(lastLoadedUrl.current === targetUrl){
            return;
        }

        if(loadingController.current){
            loadingController.current.abort();
        }

        loadingController.current = new AbortController();
        const { signal } = loadingController.current;

        setIsModelLoading(true);
        lastLoadedUrl.current = targetUrl;

        try{
            if(preloadUrls){
                preloadGLBs(preloadUrls);
            }

            const loadedModel = await loadGLB(targetUrl);

            if(signal.aborted){
                return;
            }

            if (!loadedModel) {
                console.warn(`No se pudo cargar el modelo para la URL: ${targetUrl}`);
                lastLoadedUrl.current = null;
                return;
            }

            const newModel = loadedModel.clone();
            newModel.userData.glbUrl = targetUrl;

            applyOptimizations(newModel);

            const bounds = calculateModelBounds({ scene: newModel });
            const transforms = calculateOptimalTransforms(bounds);
            
            newModel.position.set(
                transformConfig.position.x + transforms.position.x,
                transformConfig.position.y + transforms.position.y,
                transformConfig.position.z + transforms.position.z
            );

            newModel.rotation.set(
                transformConfig.rotation.x + transforms.rotation.x,
                transformConfig.rotation.y + transforms.rotation.y,
                transformConfig.rotation.z + transforms.rotation.z
            );

            newModel.scale.setScalar(transformConfig.scale * transforms.scale);

            const finalBox = new Box3().setFromObject(newModel);
            const minY = finalBox.min.y;
            if(minY < 0){
                newModel.position.y += Math.abs(minY);
            }

            if(signal.aborted){
                return;
            }

            if(modelRef.current){
                scene.remove(modelRef.current);
                modelRef.current.traverse((child) => {
                    if(child instanceof Mesh){
                        child.geometry?.dispose();
                        if(Array.isArray(child.material)){
                            child.material.forEach((mat) => mat.dispose());
                        }else{
                            child.material?.dispose();
                        }
                    }
                });
            }

            scene.add(newModel);
            modelRef.current = newModel;
            setModelBounds(bounds);

        }catch(error){
            if(signal.aborted){
                return;
            }
            console.error('Error loading GLB:', error);
            lastLoadedUrl.current = null;
        }finally{
            if(!signal.aborted){
                setIsModelLoading(false);
            }
            loadingController.current = null;
        }
    }, [
        currentGlbUrl, 
        activeSceneObject, 
        isModelLoading, 
        preloadUrls, 
        applyOptimizations, 
        transformConfig, 
        scene, 
        setIsModelLoading
    ]);

    const throttledUpdateScene = useThrottledCallback(updateSceneInternal, updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);

    useEffect(() => {
        return () => {
            if(loadingController.current){
                loadingController.current.abort();
            }

            if(modelRef.current){
                scene.remove(modelRef.current);
                modelRef.current.traverse((child) => {
                    if(child instanceof Mesh){
                        child.geometry?.dispose();
                        if(Array.isArray(child.material)){
                            child.material.forEach(mat => mat.dispose());
                        }else{
                            child.material?.dispose();
                        }
                    }
                });
            }

            materialCache.current.clear();
            modelCache.clear();

            lastLoadedUrl.current = null;
            meshRef.current = undefined;
        };
    }, [scene]);

    return { meshRef, modelBounds };
};