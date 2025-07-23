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