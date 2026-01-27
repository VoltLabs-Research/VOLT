import * as THREE from 'three';
import { ANIMATION_CONSTANTS } from '../../domain/constants/AnimationConstants';
import { lerp, easeOutCubic, computeAnimationProgress } from '../../domain/services/EasingService';
import type { Position3D } from '../../domain/value-objects/Position3D';
import type { Rotation3D } from '../../domain/value-objects/Rotation3D';

/**
 * Animation state for tracking ongoing animations.
 */
export interface AnimationState {
    // Position animation
    targetPosition: Position3D | null;
    currentPosition: Position3D;

    // Rotation animation
    targetRotation: Rotation3D | null;
    currentRotation: Rotation3D;
    rotationSettleTime: number | null;

    // Scale animation
    targetScale: number | null;
    currentScale: number;

    // Size animation (for selection box)
    sizeAnimActive: boolean;
    sizeAnimStartMs: number;
    sizeAnimFrom: Position3D | null;
    sizeAnimTo: Position3D | null;
}

/**
 * Creates initial animation state.
 */
export const createAnimationState = (): AnimationState => ({
    targetPosition: null,
    currentPosition: { x: 0, y: 0, z: 0 },
    targetRotation: null,
    currentRotation: { x: 0, y: 0, z: 0 },
    rotationSettleTime: null,
    targetScale: null,
    currentScale: 1,
    sizeAnimActive: false,
    sizeAnimStartMs: 0,
    sizeAnimFrom: null,
    sizeAnimTo: null
});

/**
 * Adapter for Three.js animation operations.
 * Bridges domain animation logic with Three.js rendering.
 */
export class ThreeJsAnimationAdapter {
    /**
     * Updates camera uniforms on point cloud materials.
     */
    updateCameraUniforms(model: THREE.Object3D, camera: THREE.Camera): void {
        model.traverse((child) => {
            if (child instanceof THREE.Points) {
                const material = child.material as THREE.ShaderMaterial;
                if (material.uniforms?.cameraPosition) {
                    material.uniforms.cameraPosition.value.copy(camera.position);
                }
            }
        });
    }

    /**
     * Computes lerped position value.
     */
    lerpPosition(current: Position3D, target: Position3D, speed: number): Position3D {
        return {
            x: lerp(current.x, target.x, speed),
            y: lerp(current.y, target.y, speed),
            z: lerp(current.z, target.z, speed)
        };
    }

    /**
     * Computes lerped rotation value.
     */
    lerpRotation(current: Rotation3D, target: Rotation3D, speed: number): Rotation3D {
        return {
            x: lerp(current.x, target.x, speed),
            y: lerp(current.y, target.y, speed),
            z: lerp(current.z, target.z, speed)
        };
    }

    /**
     * Applies position to a Three.js object.
     */
    applyPosition(object: THREE.Object3D, position: Position3D): void {
        object.position.set(position.x, position.y, position.z);
    }

    /**
     * Applies rotation to a Three.js object.
     */
    applyRotation(object: THREE.Object3D, rotation: Rotation3D): void {
        object.rotation.set(rotation.x, rotation.y, rotation.z);
    }

    /**
     * Applies scale to a Three.js object.
     */
    applyScale(object: THREE.Object3D, scale: number): void {
        object.scale.setScalar(scale);
    }

    /**
     * Computes size animation step.
     * Returns new size or null if animation complete.
     */
    computeSizeAnimationStep(
        state: AnimationState,
        now: number
    ): Position3D | null {
        if (!state.sizeAnimActive || !state.sizeAnimFrom || !state.sizeAnimTo) {
            return null;
        }

        const elapsed = now - state.sizeAnimStartMs;
        const t = computeAnimationProgress(elapsed, ANIMATION_CONSTANTS.SIZE_ANIM_DURATION_MS);
        const tt = easeOutCubic(t);

        const current: Position3D = {
            x: lerp(state.sizeAnimFrom.x, state.sizeAnimTo.x, tt),
            y: lerp(state.sizeAnimFrom.y, state.sizeAnimTo.y, tt),
            z: lerp(state.sizeAnimFrom.z, state.sizeAnimTo.z, tt)
        };

        return current;
    }

    /**
     * Computes pulse opacity for selection highlight.
     */
    computePulseOpacity(now: number, baseOpacity: number = 0.8): number {
        const pulse = Math.sin(now * ANIMATION_CONSTANTS.PULSE_SPEED);
        return baseOpacity + pulse * 0.15;
    }

    /**
     * Checks if rotation has settled (stopped changing).
     */
    hasRotationSettled(
        current: Rotation3D,
        target: Rotation3D,
        epsilon: number = ANIMATION_CONSTANTS.ROT_EPS
    ): boolean {
        return (
            Math.abs(current.x - target.x) < epsilon &&
            Math.abs(current.y - target.y) < epsilon &&
            Math.abs(current.z - target.z) < epsilon
        );
    }
}
