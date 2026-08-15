import type * as THREE from 'three';
import { forEachMaterial } from '@/modules/fractal/utils/renderable-materials';

interface UniformCarryingMaterial {
    uniforms?: Record<string, { value: unknown } | undefined>;
}

const resolveUniform = (material: THREE.Material, name: string): { value: unknown } | null => {
    const uniforms = (material as THREE.Material & UniformCarryingMaterial).uniforms;
    return uniforms?.[name] ?? null;
};

export const applyMeshOpacity = (meshes: ReadonlyArray<THREE.Mesh>, opacity: number): void => {
    meshes.forEach((mesh) => {
        forEachMaterial(mesh, (material) => {
            material.transparent = opacity < 1.0;
            material.opacity = opacity;
            material.depthWrite = opacity >= 1.0;
            const opacityUniform = resolveUniform(material, 'uOpacity');
            if (opacityUniform) {
                opacityUniform.value = opacity;
            }
            material.needsUpdate = true;
        });
    });
};

const BIASED_RENDER_ORDER = 10;

export const applyMeshDepthBias = (meshes: ReadonlyArray<THREE.Mesh>, biased: boolean): void => {
    meshes.forEach((mesh) => {
        mesh.renderOrder = biased ? BIASED_RENDER_ORDER : 0;
        forEachMaterial(mesh, (material) => {
            material.polygonOffset = biased;
            material.polygonOffsetFactor = biased ? -1 : 0;
            material.polygonOffsetUnits = biased ? -1 : 0;
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
            const colorUniform = resolveUniform(material, 'uColor');
            const target = colorUniform
                ? (colorUniform.value as THREE.Color | undefined)
                : (material as THREE.Material & { color?: THREE.Color }).color;
            if (!target) return;

            const colorMaterial = material as THREE.Material & { vertexColors: boolean };
            const userData = material.userData;

            if (override) {
                if (userData.originalColorHex === undefined) {
                    userData.originalColorHex = target.getHex();
                    userData.originalVertexColors = colorMaterial.vertexColors;
                }
                colorMaterial.vertexColors = false;
                target.copy(override);
                material.needsUpdate = true;
                return;
            }

            if (userData.originalColorHex !== undefined) {
                target.setHex(userData.originalColorHex);
                colorMaterial.vertexColors = userData.originalVertexColors ?? false;
                delete userData.originalColorHex;
                delete userData.originalVertexColors;
                material.needsUpdate = true;
            }
        });
    });
};
