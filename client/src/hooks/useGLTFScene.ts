import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, Mesh, Box3, Object3D, BufferGeometry, Material, Plane } from 'three';
import loadGltfWithCache from '@/utilities/gltf/loader';
import { calculateModelBounds, calculateOptimalTransforms } from '@/utilities/gltf/modelUtils';
import { getOptimizedMaterial } from '@/utilities/gltf/modelUtils';
import useThrottledCallback from '@/hooks/useThrottledCallback';
import useEditorStore from '@/stores/editor';
import * as THREE from 'three';

interface UseGltfSceneProps {
    currentGltfUrl: any;
    sliceClippingPlanes: Plane[];
    position: { x?: number; y?: number; z?: number };
    rotation: { x?: number; y?: number; z?: number };
    scale: number;
    enableInstancing: boolean;
    onGeometryReady: (data: { geometry: BufferGeometry; material: Material }) => void;
    updateThrottle: number;
}

export const useGltfScene = ({
    currentGltfUrl,
    sliceClippingPlanes,
    position,
    rotation,
    scale,
    enableInstancing,
    onGeometryReady,
    updateThrottle,
}: UseGltfSceneProps) => {
    const { scene } = useThree();
    const activeSceneObject = useEditorStore((state) => state.activeSceneObject);
    const modelRef = useRef<Group | null>(null);
    const meshRef = useRef<Mesh | undefined>(undefined);
    const [modelBounds, setModelBounds] = useState<ReturnType<typeof calculateModelBounds> | null>(null);
    const materialCache = useRef(new Map<string, THREE.MeshStandardMaterial>());

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
        if(!currentGltfUrl || !activeSceneObject){
            return;
        }

        const targetUrl = currentGltfUrl[activeSceneObject];
        if(!targetUrl || targetUrl === modelRef.current?.userData.gltfUrl) return;

        try{
            const gltf = await loadGltfWithCache(targetUrl);
            const newModel = gltf.scene.clone();
            newModel.userData.gltfUrl = targetUrl;
            
            applyOptimizations(newModel);
            
            const bounds = calculateModelBounds(gltf);
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
            console.error('Error loading GLTF:', error);
        }
    }, [currentGltfUrl, activeSceneObject, scene, scale, position, rotation, applyOptimizations]);

    const throttledUpdateScene = useThrottledCallback(updateSceneInternal, updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);
    
    useEffect(() => {
        return () => {
            if(modelRef.current) scene.remove(modelRef.current);
            materialCache.current.clear();
        };
    }, [scene]);

    return { meshRef, modelBounds };
};