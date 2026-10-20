import * as THREE from 'three';

const inverseMatrix = new THREE.Matrix4();
const localRay = new THREE.Ray();
const boxHitPoint = new THREE.Vector3();

const attachBoxBoundedRaycast = (mesh: THREE.Mesh): void => {
    mesh.raycast = (raycaster, intersects): void => {
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        if (!geometry.boundingBox) return;

        inverseMatrix.copy(mesh.matrixWorld).invert();
        localRay.copy(raycaster.ray).applyMatrix4(inverseMatrix);
        if (!localRay.intersectBox(geometry.boundingBox, boxHitPoint)) return;

        boxHitPoint.applyMatrix4(mesh.matrixWorld);
        const distance = raycaster.ray.origin.distanceTo(boxHitPoint);
        if (distance < raycaster.near || distance > raycaster.far) return;

        intersects.push({
            distance,
            point: boxHitPoint.clone(),
            object: mesh
        });
    };
};

export const applyBoundedMeshRaycast = (meshes: ReadonlyArray<THREE.Mesh>): void => {
    meshes.forEach((mesh) => {
        attachBoxBoundedRaycast(mesh);
    });
};
