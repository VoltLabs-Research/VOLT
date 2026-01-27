import * as THREE from 'three';
import type { ModelBounds } from '../../domain/value-objects/ModelBounds';
import type { OptimalTransforms } from '../../domain/value-objects/OptimalTransforms';
import type { Position3D } from '../../domain/value-objects/Position3D';
import { calculateOptimalTransforms } from '../../domain/services/GeometryCalculationService';

/**
 * Adapter for Three.js model operations.
 * Bridges domain logic with Three.js specifics.
 */
export class ThreeJsModelAdapter {
    /**
     * Extracts bounds from a Three.js object.
     */
    extractModelBounds(object: THREE.Object3D): ModelBounds {
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        box.getSize(size);
        box.getCenter(center);

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
     * Computes optimal transforms for a Three.js object.
     * Uses domain service for pure calculations.
     */
    computeOptimalTransforms(object: THREE.Object3D): OptimalTransforms {
        const bounds = this.extractModelBounds(object);
        return calculateOptimalTransforms(bounds);
    }

    /**
     * Applies transforms to a Three.js object.
     */
    applyTransforms(
        object: THREE.Object3D,
        transforms: OptimalTransforms
    ): void {
        object.position.set(
            transforms.position.x,
            transforms.position.y,
            transforms.position.z
        );

        object.rotation.set(
            transforms.rotation.x,
            transforms.rotation.y,
            transforms.rotation.z
        );

        object.scale.setScalar(transforms.scale);
        object.updateMatrixWorld(true);
    }

    /**
     * Copies transforms from one object to another.
     */
    copyTransforms(source: THREE.Object3D, target: THREE.Object3D): void {
        target.position.copy(source.position);
        target.rotation.copy(source.rotation);
        target.scale.copy(source.scale);
        target.updateMatrixWorld(true);
    }

    /**
     * Sets object position.
     */
    setPosition(object: THREE.Object3D, position: Position3D): void {
        object.position.set(position.x, position.y, position.z);
    }

    /**
     * Gets object position as domain value object.
     */
    getPosition(object: THREE.Object3D): Position3D {
        return {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z
        };
    }

    /**
     * Gets the minimum Z coordinate for ground adjustment.
     */
    getMinZ(object: THREE.Object3D): number {
        const box = new THREE.Box3().setFromObject(object);
        return box.min.z;
    }

    /**
     * Adjusts object to sit on the ground plane (z=0).
     */
    adjustToGround(object: THREE.Object3D): void {
        const minZ = this.getMinZ(object);
        if (minZ !== 0) {
            object.position.z -= minZ;
        }
    }
}
