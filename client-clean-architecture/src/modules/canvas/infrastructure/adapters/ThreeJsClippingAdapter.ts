import * as THREE from 'three';

/**
 * Adapter for Three.js clipping plane operations.
 */
export class ThreeJsClippingAdapter {
    /**
     * Applies clipping planes to a material.
     */
    applyToMaterial(material: THREE.Material, planes: THREE.Plane[]): void {
        if (material instanceof THREE.ShaderMaterial) {
            if (!material.uniforms.clippingPlanes) {
                material.uniforms.clippingPlanes = { value: planes };
                material.uniforms.numClippingPlanes = { value: planes.length };
            } else {
                material.uniforms.clippingPlanes.value = planes;
                material.uniforms.numClippingPlanes.value = planes.length;
            }
            material.clipping = planes.length > 0;
        } else {
            material.clippingPlanes = planes.length > 0 ? planes : null;
        }
        material.needsUpdate = true;
    }

    /**
     * Applies clipping planes to all materials in a model.
     */
    applyToModel(root: THREE.Object3D, planes: THREE.Plane[]): void {
        root.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
                const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material];

                materials.forEach((mat) => {
                    if (mat) this.applyToMaterial(mat, planes);
                });
            }
        });
    }

    /**
     * Enables or disables local clipping on the renderer.
     */
    setLocalClippingEnabled(renderer: THREE.WebGLRenderer, enabled: boolean): void {
        renderer.localClippingEnabled = enabled;
    }

    /**
     * Creates a plane from normal and constant.
     */
    createPlane(
        normalX: number,
        normalY: number,
        normalZ: number,
        constant: number
    ): THREE.Plane {
        return new THREE.Plane(
            new THREE.Vector3(normalX, normalY, normalZ),
            constant
        );
    }

    /**
     * Creates X-axis clipping plane.
     */
    createXPlane(position: number, direction: 1 | -1 = 1): THREE.Plane {
        return new THREE.Plane(new THREE.Vector3(direction, 0, 0), -position * direction);
    }

    /**
     * Creates Y-axis clipping plane.
     */
    createYPlane(position: number, direction: 1 | -1 = 1): THREE.Plane {
        return new THREE.Plane(new THREE.Vector3(0, direction, 0), -position * direction);
    }

    /**
     * Creates Z-axis clipping plane.
     */
    createZPlane(position: number, direction: 1 | -1 = 1): THREE.Plane {
        return new THREE.Plane(new THREE.Vector3(0, 0, direction), -position * direction);
    }
}
