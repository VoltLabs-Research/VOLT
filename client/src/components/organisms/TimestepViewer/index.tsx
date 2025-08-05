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

import React, { useState, useMemo, useRef } from 'react';
import CameraManager from '@/components/atoms/scene/CameraManager';
import useInstancedRenderer from '@/hooks/canvas/useInstancedRenderer';
import useSlicingPlanes from '@/hooks/canvas/useSlicingPlanes';
import { useFrame } from '@react-three/fiber';
import { useBVH, Instances } from '@react-three/drei';
import { Vector3, BufferGeometry, Material } from 'three';
import { useGlbScene } from '@/hooks/canvas/useGLBScene';
import { getOptimizedMaterial } from '@/utilities/glb/modelUtils';
import useEditorStore from '@/stores/editor';

interface TimestepViewerProps {
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
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing = false,
    instanceCount = 1000,
    updateThrottle = 16,
}) => {
    const [geometryData, setGeometryData] = useState<{ geometry: BufferGeometry | null; material: Material | null }>({ geometry: null, material: null });
    const { instancedMeshRef, updateInstances } = useInstancedRenderer(instanceCount);
    const instancePositions = useRef<Vector3[]>([]);
    const slicePlaneConfig = useEditorStore((state) => state.slicePlaneConfig);
    const sliceClippingPlanes = useSlicingPlanes(enableSlice, slicePlaneConfig);
    const currentGlbUrl = useEditorStore((state) => state.currentGlbUrl);
    const nextGlbUrl = useEditorStore((state) => state.nextGlbUrl);

    const { meshRef, modelBounds } = useGlbScene({
        currentGlbUrl,
        nextGlbUrl,
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
    
    const optimizedMaterial = useMemo(() => {
        if(!geometryData.material || !enableInstancing) return null;
        return getOptimizedMaterial(geometryData.material, sliceClippingPlanes);
    }, [geometryData.material, sliceClippingPlanes, enableInstancing]);

    return (
        <>
            {enableInstancing && geometryData.geometry && optimizedMaterial && (
                <Instances limit={1000} range={1000}>
                    <instancedMesh
                        ref={instancedMeshRef}
                        args={[geometryData.geometry, optimizedMaterial, instanceCount]}
                        frustumCulled={true}
                    />
                </Instances>
            )}

            {autoFit && modelBounds && (
                <CameraManager modelBounds={modelBounds} orbitControlsRef={orbitControlsRef} />
            )}
        </>
    );
};

export default React.memo(TimestepViewer);