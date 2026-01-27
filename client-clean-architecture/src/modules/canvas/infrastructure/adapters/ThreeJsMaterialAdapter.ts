import * as THREE from 'three';

/**
 * Adapter to manage and optimize Three.js materials.
 */
export class ThreeJsMaterialAdapter {
    private cache: Map<string, THREE.MeshStandardMaterial> = new Map();

    /**
     * Gets or creates an optimized material for the given base material and clipping planes.
     */
    getOptimizedMaterial(
        baseMaterial: THREE.Material,
        clippingPlanes: THREE.Plane[]
    ): THREE.MeshStandardMaterial {
        const key = `${baseMaterial.uuid}-${clippingPlanes.length}`;
        
        if (this.cache.has(key)) {
            const cached = this.cache.get(key)!;
            cached.clippingPlanes = clippingPlanes;
            return cached;
        }

        let optimized: THREE.MeshStandardMaterial;

        if (baseMaterial instanceof THREE.MeshStandardMaterial) {
            optimized = new THREE.MeshStandardMaterial({
                color: baseMaterial.color,
                map: baseMaterial.map,
                normalMap: baseMaterial.normalMap,
                roughnessMap: baseMaterial.roughnessMap,
                metalnessMap: baseMaterial.metalnessMap,
                emissiveMap: baseMaterial.emissiveMap,
                emissive: baseMaterial.emissive,
                roughness: baseMaterial.roughness,
                metalness: baseMaterial.metalness,
                opacity: baseMaterial.opacity,
                vertexColors: baseMaterial.vertexColors,
                clipShadows: true,
                transparent: false,
                alphaTest: 0.1,
                side: THREE.FrontSide,
                depthWrite: true,
                depthTest: true,
            });
        } else if (baseMaterial instanceof THREE.MeshBasicMaterial) {
            optimized = new THREE.MeshStandardMaterial({
                color: baseMaterial.color,
                map: baseMaterial.map,
                opacity: baseMaterial.opacity,
                vertexColors: baseMaterial.vertexColors,
                clipShadows: true,
                transparent: false,
                alphaTest: 0.1,
                side: THREE.FrontSide,
                depthWrite: true,
                depthTest: true,
            });
        } else {
            optimized = baseMaterial.clone() as THREE.MeshStandardMaterial;
        }

        if (clippingPlanes.length > 0) {
            optimized.clippingPlanes = clippingPlanes;
        }

        optimized.precision = 'highp';
        optimized.userData.isOptimized = true;

        this.cache.set(key, optimized);
        return optimized;
    }

    /**
     * Clears the material cache.
     */
    clearCache(): void {
        this.cache.forEach((material) => material.dispose());
        this.cache.clear();
    }
}

export const materialAdapter = new ThreeJsMaterialAdapter();
