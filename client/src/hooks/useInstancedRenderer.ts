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

import { useRef, useCallback } from 'react';
import { Vector3, InstancedMesh, Object3D, Matrix4 } from 'three';
import * as THREE from 'three';

const useInstancedRenderer = (count: number) => {
    const instancedMeshRef = useRef<InstancedMesh>(null);
    const matrixCache = useRef<Matrix4[]>([]);
    const tempObject = useRef(new Object3D());

    const updateInstances = useCallback((positions: Vector3[], rotations?: THREE.Euler[], scales?: Vector3[]) => {
        const mesh = instancedMeshRef.current;
        if(!mesh || !positions.length) return;

        const temp = tempObject.current;
        const matrices = matrixCache.current;
        const maxCount = Math.min(count, positions.length);

        if(matrices.length !== maxCount){
            matrices.length = maxCount;
            for(let i = 0; i < maxCount; i++){
                if (!matrices[i]) matrices[i] = new Matrix4();
            }
        }

        for(let i = 0; i < maxCount; i++){
            temp.position.copy(positions[i]);
            if(rotations?.[i]) temp.rotation.copy(rotations[i]);

            if(scales?.[i]){
                temp.scale.copy(scales[i]);
            }else{
                temp.scale.setScalar(1);
            }

            temp.updateMatrix();
            matrices[i].copy(temp.matrix);
            mesh.setMatrixAt(i, temp.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = maxCount;
    }, [count]);

    return { instancedMeshRef, updateInstances };
};

export default useInstancedRenderer;