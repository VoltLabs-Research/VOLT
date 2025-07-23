import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { type TrajectoryGLTFs } from '@/stores/editor';
import { Group, Box3, Vector3, Plane, Mesh } from 'three';
import { calculateModelBounds, calculateOptimalTransforms } from '@/utilities/gltf/modelUtils';
import loadGltfWithCache from '@/utilities/gltf/loader';
import CameraManager from '@/components/atoms/CameraManager';

interface TimestepViewerProps{
    currentGltfUrl: TrajectoryGLTFs | null;
    nextGltfUrl: string | null;
    rotation?: { x?: number; y?: number; z?: number };
    position?: { x?: number; y?: number; z?: number };
    scale?: number;
    autoFit?: boolean;
    orbitControlsRef?: any;

    enableSlice?: boolean;
    slicePlane?: {
        normal: { x: number; y: number; z: number };
        distance: number;
        slabWidth?: number;
        reverseOrientation?: boolean;
    };
}

const TimestepViewer: React.FC<TimestepViewerProps> = ({
    currentGltfUrl,
    nextGltfUrl,
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,

    enableSlice = true,
    slicePlane = {
        normal: { x: 0, y: 0, z: 0 }, 
        distance: 0, 
        slabWidth: 0.05,
        reverseOrientation: true,
    },
}) => {
    const { scene } = useThree();
    const modelRef = useRef<Group | null>(null);
    const [modelBounds, setModelBounds] = useState<ReturnType<typeof calculateModelBounds> | null>(null);

    const sliceClippingPlanes = useMemo(() => {
        if (!enableSlice || !modelBounds) return [];

        const planes: Plane[] = [];
        const normal = new Vector3(slicePlane.normal.x, slicePlane.normal.y, slicePlane.normal.z).normalize();
        let distance = slicePlane.distance;

        const plane1 = new Plane(normal.clone(), -distance);

        if(slicePlane.slabWidth && slicePlane.slabWidth > 0){
            planes.push(plane1);
            const plane2Distance = distance + slicePlane.slabWidth;
            const plane2 = new Plane(normal.clone().negate(), plane2Distance);
            planes.push(plane2);
        }else{
            if(slicePlane.reverseOrientation){
                planes.push(new Plane(normal.clone().negate(), distance));
            }else{
                planes.push(plane1);
            }
        }

        return planes;
    }, [enableSlice, slicePlane, modelBounds]);

    const combinedClippingPlanes = useMemo(() => {
        const allPlanes: Plane[] = [];
        if(enableSlice){
            allPlanes.push(...sliceClippingPlanes);
        }
        return allPlanes;
    }, [enableSlice, sliceClippingPlanes]);


    const updateScene = useCallback(async () => {
        if(!currentGltfUrl){
            if(modelRef.current){
                scene.remove(modelRef.current);
                modelRef.current = null;
                setModelBounds(null);
            }
            return;
        }

        const gltf = await loadGltfWithCache(currentGltfUrl.defect_mesh!);
        const newModel = gltf.scene.clone();

        newModel.traverse((child) => {
            if(child instanceof Mesh){
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material) => {
                    material.clippingPlanes = combinedClippingPlanes;
                    material.clipShadows = true;
                });
            }
        });

        // auto fit
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
            newModel.position.y += Math.abs(minY) + 0.1;
        }

        if(modelRef.current){
            scene.remove(modelRef.current);
        }

        scene.add(newModel);
        modelRef.current = newModel;
    }, [currentGltfUrl, scene, scale, position, rotation, autoFit, combinedClippingPlanes]); // Dependencia clave

    useEffect(() => {
        if(!nextGltfUrl) return;
        loadGltfWithCache(nextGltfUrl).catch(() => {});
    }, [nextGltfUrl]);

    useEffect(() => {
        updateScene();
    }, [updateScene]);

    useEffect(() => {
        return () => {
            if(modelRef.current){
                scene.remove(modelRef.current);
            }
        };
    }, [scene]);

    return (autoFit && modelBounds) && (
        <CameraManager
            modelBounds={modelBounds}
            orbitControlsRef={orbitControlsRef}
        />
    );
};

export default TimestepViewer;