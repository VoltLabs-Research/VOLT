import { BufferGeometry, Material, InstancedMesh, Scene, Camera, Vector3 } from 'three';
import { createLODGeometry } from '@/utilities/glb/lodGeometry';
import { GLB_CONSTANTS } from '@/utilities/glb/loader';
import ObjectPools from '@/utilities/glb/objectPools';

class InstancedMeshManager{
    private instancedMeshes: InstancedMesh[] = [];
    private lodUpdateNeeded = false;

    constructor(private scene: Scene){}

    createInstancedMeshes(geometry: BufferGeometry, material: Material): InstancedMesh[]{
        this.cleanup();
        
        this.instancedMeshes = GLB_CONSTANTS.LOD_LEVELS.map((lodLevel, index) => {
            const lodGeometry = createLODGeometry(geometry, lodLevel);
            const maxInstances = Math.min(
                GLB_CONSTANTS.MAX_VISIBLE_INSTANCES,
                Math.floor(GLB_CONSTANTS.MAX_VISIBLE_INSTANCES * lodLevel)
            );

            const instancedMesh = new InstancedMesh(lodGeometry, material.clone(), maxInstances);
            instancedMesh.frustumCulled = true;
            instancedMesh.count = 0;
            instancedMesh.visible = false;
            instancedMesh.renderOrder = index;

            this.scene.add(instancedMesh);
            return instancedMesh;
        });

        return this.instancedMeshes;
    }

    updateInstances(camera: Camera, atoms: any[], visibleIndices: Set<number>, scale: number): void{
        if(!this.lodUpdateNeeded || !atoms.length) return;

        const cameraPos = camera.position;
        const visibleAtoms = Array.from(visibleIndices)
            .map((i) => atoms[i])
            .filter((atom) => atom?.visible && !isNaN(atom.position.x));
        
        const atomsByLOD: any[][] = GLB_CONSTANTS.LOD_LEVELS.map(() => []);

        visibleAtoms.forEach((atom) => {
            const distance = atom.position.distanceTo(cameraPos);
            const lodIndex = distance > 30 ? 2 : distance > 20 ? 1 : 0;
            atomsByLOD[lodIndex]?.push(atom);
        });

        const matrixArray = new Float32Array(16 * GLB_CONSTANTS.MAX_VISIBLE_INSTANCES);

        this.instancedMeshes.forEach((mesh, lodIndex) => {
            const atoms = atomsByLOD[lodIndex] || [];
            const count = Math.min(atoms.length, mesh.instanceMatrix.count);

            mesh.visible = count > 0;
            mesh.count = count;

            if(count > 0){
                const tempMatrix = ObjectPools.getPooledMatrix();
                const scaleVector = new Vector3();

                for(let i = 0; i < count; i++){
                    const atom = atoms[i];
                    scaleVector.setScalar(atom.size * scale);
                    tempMatrix.setPosition(atom.position);
                    tempMatrix.scale(scaleVector);
                    matrixArray.set(tempMatrix.elements, i * 16);
                }

                mesh.instanceMatrix.array.set(matrixArray.subarray(0, count * 16));
                mesh.instanceMatrix.needsUpdate = true;
                ObjectPools.returnPooledMatrix(tempMatrix);
            }
        });

        this.lodUpdateNeeded = false;
    }

    markLODUpdateNeeded(): void{
        this.lodUpdateNeeded = true;
    }

    cleanup(): void{
        this.instancedMeshes.forEach((mesh) => {
            if(mesh.parent) mesh.parent.remove(mesh);

            mesh.geometry?.dispose();
            if(Array.isArray(mesh.material)){
                mesh.material.forEach((material: any) => material.dispose());
            }else{
                mesh.material?.dispose();
            }
        });

        this.instancedMeshes = [];
    }

    getInstancedMeshes(): InstancedMesh[]{
        return this.instancedMeshes;
    }
}

export default InstancedMeshManager;