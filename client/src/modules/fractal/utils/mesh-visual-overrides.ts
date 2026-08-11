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

const OVERLAY_RENDER_ORDER = 10;

export const applyMeshDepthOverlay = (meshes: ReadonlyArray<THREE.Mesh>, overlay: boolean): void => {
    meshes.forEach((mesh) => {
        mesh.renderOrder = overlay ? OVERLAY_RENDER_ORDER : 0;
        forEachMaterial(mesh, (material) => {
            const userData = material.userData;
            if (overlay) {
                if (userData.baseDepthTest === undefined) {
                    userData.baseDepthTest = material.depthTest;
                    userData.baseDepthWrite = material.depthWrite;
                }
                material.depthTest = false;
                material.depthWrite = false;
                material.needsUpdate = true;
                return;
            }

            if (userData.baseDepthTest === undefined) return;
            material.depthTest = userData.baseDepthTest as boolean;
            material.depthWrite = userData.baseDepthWrite as boolean;
            delete userData.baseDepthTest;
            delete userData.baseDepthWrite;
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
