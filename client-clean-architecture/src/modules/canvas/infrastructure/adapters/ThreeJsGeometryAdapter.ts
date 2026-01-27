import * as THREE from 'three';
import type { Position3D } from '../../domain/value-objects/Position3D';
import type { ModelBounds } from '../../domain/value-objects/ModelBounds';
import type { BoxBounds } from '../../domain/value-objects/BoxBounds';

/**
 * Adapter to translate Three.js geometry data into Domain value objects.
 */
export class ThreeJsGeometryAdapter {
    /**
     * Extracts model bounds from a Three.js object.
     */
    extractModelBounds(object: THREE.Object3D): ModelBounds {
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        const boundingSphere = new THREE.Sphere();
        box.getBoundingSphere(boundingSphere);

        return {
            size: { x: size.x, y: size.y, z: size.z },
            center: { x: center.x, y: center.y, z: center.z },
            maxDimension: Math.max(size.x, size.y, size.z),
            sphereRadius: boundingSphere.radius
        };
    }

    /**
     * Translates a Box3 into BoxBounds domain object.
     */
    translateBox3ToBounds(box: THREE.Box3): BoxBounds {
        return {
            xlo: box.min.x,
            ylo: box.min.y,
            zlo: box.min.z,
            xhi: box.max.x,
            yhi: box.max.y,
            zhi: box.max.z
        };
    }

    /**
     * Translates a Vector3 into Position3D domain object.
     */
    translateVector3ToPosition(vector: THREE.Vector3): Position3D {
        return {
            x: vector.x,
            y: vector.y,
            z: vector.z
        };
    }

    /**
     * Translates a Position3D into Three.js Vector3.
     */
    translatePositionToVector3(position: Position3D): THREE.Vector3 {
        return new THREE.Vector3(position.x, position.y, position.z);
    }
}
