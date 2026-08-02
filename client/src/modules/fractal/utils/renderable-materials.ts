import type * as THREE from 'three';

/** Normalises Three's `Material | Material[]` union on a renderable object. */
export const forEachMaterial = (
    object: { material: THREE.Material | THREE.Material[] },
    apply: (material: THREE.Material) => void
): void => {
    if (Array.isArray(object.material)) {
        object.material.forEach(apply);
        return;
    }
    apply(object.material);
};
