import React, { useState, useMemo, useRef, useEffect } from 'react';
import CameraManager from '@/components/atoms/CameraManager';
import useInstancedRenderer from '@/hooks/useInstancedRenderer';
import useSlicingPlanes from '@/hooks/useSlicingPlanes';
import loadGltfWithCache from '@/utilities/gltf/loader';
import { useFrame } from '@react-three/fiber';
import { useBVH } from '@react-three/drei';
import { Vector3, BufferGeometry, Material } from 'three';
import { useGltfScene } from '@/hooks/useGLTFScene';
import { getOptimizedMaterial } from '@/utilities/gltf/modelUtils';
import type { TrajectoryGLTFs } from '@/stores/editor';

interface TimestepViewerProps {
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
    enableInstancing?: boolean;
    instanceCount?: number;
    updateThrottle?: number;
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
    enableInstancing = false,
    instanceCount = 1000,
    updateThrottle = 16,
}) => {
    const [geometryData, setGeometryData] = useState<{ geometry: BufferGeometry | null; material: Material | null }>({ geometry: null, material: null });
    const { instancedMeshRef, updateInstances } = useInstancedRenderer(instanceCount);
    const instancePositions = useRef<Vector3[]>([]);
    const sliceClippingPlanes = useSlicingPlanes(enableSlice, slicePlane);

    const { meshRef, modelBounds } = useGltfScene({
        currentGltfUrl,
        sliceClippingPlanes,
        position,
        rotation,
        scale,
        enableInstancing,
        onGeometryReady: setGeometryData,
        updateThrottle,
    });

    useBVH(meshRef, { maxLeafTris: 10, verbose: false });

    useFrame(() => {
        if(enableInstancing && instancedMeshRef.current && geometryData.geometry){
            if(instancePositions.current.length !== instanceCount){
                instancePositions.current = Array.from({
                    length: instanceCount 
                }, () => {
                    return new Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10)
                });
            }
            updateInstances(instancePositions.current);
        }
    });
    
    useEffect(() => {
        if(nextGltfUrl){
            loadGltfWithCache(nextGltfUrl).catch(() => {});
        }
    }, [nextGltfUrl]);

    const materialCache = useRef(new Map());

    const optimizedMaterial = useMemo(() => {
        if(!geometryData.material || !enableInstancing) return null;
        return getOptimizedMaterial(geometryData.material, sliceClippingPlanes, materialCache.current);
    }, [geometryData.material, sliceClippingPlanes, enableInstancing]);

    return (
        <>
            {enableInstancing && geometryData.geometry && optimizedMaterial && (
                <instancedMesh
                    ref={instancedMeshRef}
                    args={[geometryData.geometry, optimizedMaterial, instanceCount]}
                    frustumCulled={true}
                />
            )}

            {autoFit && modelBounds && (
                <CameraManager modelBounds={modelBounds} orbitControlsRef={orbitControlsRef} />
            )}
        </>
    );
};

export default React.memo(TimestepViewer);