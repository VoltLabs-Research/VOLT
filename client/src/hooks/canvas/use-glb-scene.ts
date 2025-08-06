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
import useConfigurationStore from '@/stores/editor/configuration';
import useTimestepStore from '@/stores/editor/timesteps';
import loadGLB, { preloadGLBs, modelCache } from '@/utilities/glb/loader';
import useLogger from '@/hooks/core/use-logger';
import useIsMobile from '@/hooks/ui/use-is-mobile';
import * as THREE from 'three';

const DEFAULT_POSITION = { x: 0, y: 0, z: 0 };
const DEFAULT_ROTATION = { x: 0, y: 0, z: 0 };

interface Position {
    x?: number;
    y?: number;
    z?: number;
}

interface Rotation {
    x?: number;
    y?: number;
    z?: number;
}

interface UseGlbSceneProps {
    currentGlbUrl: any;
    nextGlbUrl: any;
    sliceClippingPlanes: Plane[];
    position: Position;
    rotation: Rotation;
    scale: number;
    enableInstancing: boolean;
    onGeometryReady: (data: { geometry: BufferGeometry; material: Material }) => void;
    updateThrottle: number;
}

export const useGlbScene = ({
    sliceClippingPlanes,
    position,
    rotation,
    scale,
    enableInstancing,
    onGeometryReady,
    updateThrottle,
}: UseGlbSceneProps) => {
    const { scene } = useThree();
    const logger = useLogger('use-glb-scene');

    const activeSceneObject = useConfigurationStore((state) => state.activeSceneObject);
    const setIsModelLoading = useConfigurationStore((state) => state.setIsModelLoading);
    const isLoading = useConfigurationStore((state) => state.isModelLoading);
    const isMobile = useIsMobile();

    const currentGlbUrl = useTimestepStore((state) => state.currentGlbUrl);
    const nextGlbUrl = useTimestepStore((state) => state.nextGlbUrl);

    const modelRef = useRef<Group | null>(null);
    const meshRef = useRef<Mesh | undefined>(undefined);
    const materialCache = useRef(new Map<string, THREE.MeshStandardMaterial>());

    const [modelBounds, setModelBounds] = useState<ReturnType<typeof calculateModelBounds> | null>(null);

    const getTargetUrl = useCallback((): string | null => {
        if(!currentGlbUrl || !activeSceneObject){
            return null;
        }

        return currentGlbUrl[activeSceneObject];
    }, [currentGlbUrl, activeSceneObject]);

    const shouldUpdateModel = useCallback((targetUrl: string | null): boolean => {
        if(!targetUrl) return false;
        
        return targetUrl !== modelRef.current?.userData.glbUrl;
    }, []);

    const handleModelPreloading = useCallback(() => {
        // Safari, Chrome and blah blah blah are reloaded when 
        // loading heavy glb models and these preloads 
        // will only make the situation worse.
        if(isMobile) return;

        const preloadUrls = [
            currentGlbUrl?.dislocations,
           nextGlbUrl?.dislocations,
            nextGlbUrl?.[activeSceneObject]
        ].filter(Boolean);

        if(preloadUrls.length > 0){
            preloadGLBs(preloadUrls);
        }
    }, [isMobile, currentGlbUrl, nextGlbUrl, activeSceneObject]);

    const applyMeshOptimizations = useCallback((mesh: Mesh) => {
        mesh.frustumCulled = true;

        if(!meshRef.current){
            meshRef.current = mesh;
        }

        if(enableInstancing){
            onGeometryReady({
                geometry: mesh.geometry,
                material: mesh.material as Material
            });
            return;
        }

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((material, index) => {
            if(material?.isMaterial){
                const optimizedMaterial = getOptimizedMaterial(
                    material,
                    sliceClippingPlanes,
                );

                if(Array.isArray(mesh.material)){
                    mesh.material[index] = optimizedMaterial;
                }else{
                    mesh.material = optimizedMaterial;
                }
            }
        });
    }, [sliceClippingPlanes, enableInstancing, onGeometryReady]);

    const applyObjectOptimizations = useCallback((object: Object3D) => {
        object.traverse((child) => {
            if(child instanceof Mesh && child.geometry?.attributes?.position){
                applyMeshOptimizations(child);
            }
        });
    }, [applyMeshOptimizations]);

    const calculateModelTransforms = useCallback((model: Group) => {
        const bounds = calculateModelBounds({ scene: model });
        const optimalTransforms = calculateOptimalTransforms(bounds);

        setModelBounds(bounds);
        return { bounds, transforms: optimalTransforms };
    }, []);

    const applyModelTransforms = useCallback((
        model: Group, 
        transforms: ReturnType<typeof calculateOptimalTransforms>
    ) => {
        model.position.set(
            (position.x ?? DEFAULT_POSITION.x) + transforms.position.x,
            (position.y ?? DEFAULT_POSITION.y) + transforms.position.y,
            (position.z ?? DEFAULT_POSITION.z) + transforms.position.z
        );

        model.rotation.set(
            (rotation.x ?? DEFAULT_ROTATION.x) + transforms.rotation.x,
            (rotation.y ?? DEFAULT_ROTATION.y) + transforms.rotation.y,
            (rotation.z ?? DEFAULT_ROTATION.z) + transforms.rotation.z
        );

        model.scale.setScalar(scale * transforms.scale);
    }, [position, rotation, scale]);

    const adjustModelToGround = useCallback((model: Group) => {
        const finalBox = new Box3().setFromObject(model);
        const minY = finalBox.min.y;
        
        if(minY < 0){
            model.position.y += Math.abs(minY);
        }
    }, []);

    const replaceSceneModel = useCallback((newModel: Group) => {
        if(modelRef.current){
            scene.remove(modelRef.current);
        }

        scene.add(newModel);
        modelRef.current = newModel;
    }, [scene]);

    const loadAndSetupModel = useCallback(async (targetUrl: string): Promise<void> => {
        try{
            const loadedModel = await loadGLB(targetUrl);

            if(!loadedModel){
                throw new Error(`Failed to load model from URL: ${targetUrl}`);
            }

            const newModel = loadedModel.clone();
            newModel.userData.glbUrl = targetUrl;

            applyObjectOptimizations(newModel);

            const { transforms } = calculateModelTransforms(newModel);
            applyModelTransforms(newModel, transforms);

            adjustModelToGround(newModel);

            replaceSceneModel(newModel);
        }catch(err){
            logger.error('Error loading GLB model:', {
                url: targetUrl,
                error: err instanceof Error ? err.message : String(err)
            });

            throw err;
        }
    }, [
        applyObjectOptimizations,
        calculateModelTransforms,
        applyModelTransforms,
        adjustModelToGround,
        replaceSceneModel
    ]);

    const updateScene = useCallback(async (): Promise<void> => {
        setIsModelLoading(true);

        try{
            const targetUrl = getTargetUrl();
            if(!shouldUpdateModel(targetUrl)){
                return;
            }

            if(targetUrl){
                await loadAndSetupModel(targetUrl);
                handleModelPreloading();
            }
        }catch(err){
            logger.error('Failed to update scene:', err);
        }finally{
            setIsModelLoading(false);
        }
    }, [
        getTargetUrl,
        shouldUpdateModel,
        loadAndSetupModel,
        handleModelPreloading,
        setIsModelLoading
    ]);

    const throttledUpdateScene = useThrottledCallback(updateScene, updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);

    useEffect(() => {
        return () => {
            if(modelRef.current){
                scene.remove(modelRef.current);
            }

            materialCache.current.clear();
            modelCache.clear();
        };
    }, [scene]);

    return { 
        meshRef, 
        modelBounds,
        isLoading
    };
};