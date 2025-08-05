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
import { useThree } from '@react-three/fiber';
import { Group, Mesh, Box3, Object3D, BufferGeometry, Material, Plane } from 'three';
import { calculateModelBounds, calculateOptimalTransforms } from '@/utilities/glb/modelUtils';
import { getOptimizedMaterial } from '@/utilities/glb/modelUtils';
import useThrottledCallback from '@/hooks/ui/use-throttled-callback';
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
    const activeSceneObject = useEditorStore((state) => state.activeSceneObject);
    const modelRef = useRef<Group | null>(null);
    const meshRef = useRef<Mesh | undefined>(undefined);
    const [modelBounds, setModelBounds] = useState<ReturnType<typeof calculateModelBounds> | null>(null);
    const materialCache = useRef(new Map<string, THREE.MeshStandardMaterial>());
    const setIsModelLoading = useEditorStore((state) => state.setIsModelLoading);

    const applyOptimizations = useCallback((object: Object3D) => {
        object.traverse((child) => {
            if(child instanceof Mesh && child.geometry?.attributes?.position){
                child.frustumCulled = true;
                if(!meshRef.current){
                    meshRef.current = child;
                }

                if(enableInstancing){
                    onGeometryReady({ geometry: child.geometry, material: child.material as Material });
                }

                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material, index) => {
                    if(material?.isMaterial && !enableInstancing){
                        const optimized = getOptimizedMaterial(material, sliceClippingPlanes, materialCache.current);
                        if(Array.isArray(child.material)){
                            child.material[index] = optimized;
                        }else{
                            child.material = optimized;
                        }
                    }
                });
            }
        });
    }, [sliceClippingPlanes, enableInstancing, onGeometryReady]);

    const updateSceneInternal = useCallback(async () => {
        setIsModelLoading(true);

        if(!currentGlbUrl || !activeSceneObject){
            return;
        }

        const targetUrl = currentGlbUrl[activeSceneObject];
        console.log(targetUrl)
        //if(!targetUrl || targetUrl === modelRef.current?.userData.gltfUrl) return;

        try{
            const loadedModel = await loadGLB(targetUrl);
            console.log('loaded model')
            
            // We render the GLB of the next frame given what the user is viewing 
            // in the current frame. Why would we load things the user isn't going 
            // to touch? Perhaps it will be useful in the future for the user 
            // to be able to decide what to preload.
            // We preload dislocations because the sizes are negligible (~1mb - ~2mb).
            preloadGLBs([
                currentGlbUrl?.dislocations,
                nextGlbUrl?.dislocations,
                nextGlbUrl?.[activeSceneObject]
            ]);


            if (!loadedModel) {
                console.warn(`No se pudo cargar el modelo para la URL: ${targetUrl}`);
                return;
            }
            
            const newModel = loadedModel.clone();
            newModel.userData.glbUrl = targetUrl;
            
            applyOptimizations(newModel);
            const bounds = calculateModelBounds({ scene: newModel });
            const transforms = calculateOptimalTransforms(bounds);
            setModelBounds(bounds);
            newModel.position.set(
                (position.x || 0) + transforms.position.x,
                (position.y || 0) + transforms.position.y,
                (position.z || 0) + transforms.position.z
            );

            newModel.rotation.set(
                (rotation.x || 0) + transforms.rotation.x,
                (rotation.y || 0) + transforms.rotation.y,
                (rotation.z || 0) + transforms.rotation.z
            );

            newModel.scale.setScalar(scale * transforms.scale);
            const finalBox = new Box3().setFromObject(newModel);
            const minY = finalBox.min.y;

            if(minY < 0){
                newModel.position.y += Math.abs(minY);
            }

            if(modelRef.current){
                scene.remove(modelRef.current);
            }

            scene.add(newModel);
            modelRef.current = newModel;
        }catch(error){
            console.error('Error loading GLB:', error);
        }finally{
            setIsModelLoading(false);
        }
    }, [currentGlbUrl, activeSceneObject, sliceClippingPlanes]);

    const throttledUpdateScene = useThrottledCallback(updateSceneInternal, updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);
    
    useEffect(() => {
        return () => {
            if(modelRef.current) scene.remove(modelRef.current);
            materialCache.current.clear();
            modelCache.clear();
        };
    }, [scene]);

    return { meshRef, modelBounds };
};