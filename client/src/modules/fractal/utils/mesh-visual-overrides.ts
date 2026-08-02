import type * as THREE from 'three';
import { forEachMaterial } from '@/modules/fractal/utils/renderable-materials';

export const applyMeshOpacity = (meshes: ReadonlyArray<THREE.Mesh>, opacity: number): void => {
    meshes.forEach((mesh) => {
        forEachMaterial(mesh, (material) => {
            material.transparent = opacity < 1.0;
            material.opacity = opacity;
            material.needsUpdate = true;
        });
    });
};

export const applyMeshColorOverride = (
    meshes: ReadonlyArray<THREE.Mesh>,
    override: THREE.Color | null
): void => {
    meshes.forEach((mesh) => {
        forEachMaterial(mesh, (material) => {
            if (!('color' in material)) return;
            const colorMaterial = material as THREE.MeshStandardMaterial;
            const userData = colorMaterial.userData;

            if (override) {
                if (userData.originalColorHex === undefined) {
                    userData.originalColorHex = colorMaterial.color.getHex();
                    userData.originalVertexColors = colorMaterial.vertexColors;
                }
                colorMaterial.vertexColors = false;
                colorMaterial.color.copy(override);
                colorMaterial.needsUpdate = true;
                return;
            }

            if (userData.originalColorHex !== undefined) {
                colorMaterial.color.setHex(userData.originalColorHex);
                colorMaterial.vertexColors = userData.originalVertexColors ?? false;
                delete userData.originalColorHex;
                delete userData.originalVertexColors;
                colorMaterial.needsUpdate = true;
            }
        });
    });
};
