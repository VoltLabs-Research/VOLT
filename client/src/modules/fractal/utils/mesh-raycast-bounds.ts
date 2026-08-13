import * as THREE from 'three';

/**
 * Swaps the per-triangle raycast on loaded meshes for a bounding-box test.
 *
 * R3F re-raycasts the whole DragControls subtree on every `pointermove`: drei's
 * DragControls hands use-gesture an `onHover` handler unconditionally, so its
 * group always carries `onPointerEnter`/`onPointerLeave` and always survives
 * R3F's pointer-move filter, whether or not we pass an `onHover` prop. The model
 * hangs inside that subtree, and `intersectObject` recurses, so with the stock
 * `THREE.Mesh.raycast` every cursor pass over the geometry ran a brute-force
 * ray/triangle sweep across every facet. Surface meshes and DXA tube networks
 * are exported undecimated, so that stalled the main thread — while point clouds
 * stayed smooth, because the material pipeline already gives them a bounded
 * raycast. This is the same trade for meshes.
 *
 * The bounding box is used rather than the bounding sphere the point clouds use:
 * dislocation tubes run diagonally across the cell, and their sphere reaches well
 * past the geometry in every direction.
 *
 * What this gives up: a hit now carries the box entry point instead of the exact
 * surface point, and the cursor counts as over the model anywhere inside its AABB.
 * Neither reaches anything that needs better. DragControls only differences the hit
 * point against the model origin to hold a stable grab offset for the rest of the
 * drag, selection ignores it, and the simulation cell already publishes an
 * invisible full-cell box for picking whenever it is shown — which is the default.
 */

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
