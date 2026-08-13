import type * as THREE from 'three';
import { forEachMaterial } from '@/modules/fractal/utils/renderable-materials';

/**
 * The OVITO-shaded surfaces are ShaderMaterials, which read their base colour and
 * opacity from uniforms rather than from `material.color` / `material.opacity`.
 * Both overrides below have to reach either kind, so they resolve the uniform when
 * one is present and fall back to the standard-material property otherwise.
 */
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
            // A semi-transparent surface must stop writing depth, the same way
            // applyPointCloudOpacity handles it. Left on, a closed surface occludes
            // itself: whichever of its near and far sheets happens to be drawn first
            // wins, so a shell that should read as two faint layers comes out patchy
            // and still hides whatever sits inside it.
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

/**
 * Nudges a mesh toward the camera without exempting it from the depth test.
 *
 * Line scenes (dislocation tubes, bonds) are thin geometry that shares space
 * with the surfaces and point clouds they annotate, so they need to win
 * co-planar ties. They must NOT win every tie: OVITO renders dislocations and
 * the defect mesh into one depth buffer, so segments that run inside or behind
 * the mesh are correctly hidden. Turning depthTest off here made the whole
 * network float above the surface instead, which is what the overlay looked
 * wrong for. A polygon offset buys the tie-break at no cost to occlusion.
 */
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
