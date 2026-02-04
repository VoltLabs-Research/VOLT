import type { ExtendedSceneState } from '@/features/canvas/types';
import { Euler, Box3, Group, Vector3 } from 'three';
import { ANIMATION_CONSTANTS } from '@/features/canvas/utilities/simulation-box';

export default class TransformationManager {
    constructor(
        private state: ExtendedSceneState
    ){}

    rotate(dx: number, dy: number, dz: number): void {
        if (!this.state.selected) return;

        const r = this.state.currentRotation.clone();
        r.x += dx;
        r.y += dy;
        r.z += dz;

        this.state.targetRotation = r;
        this.state.lastInteractionTime = Date.now();
    }

    scale(delta: number): void {
        if (!this.state.selected) return;

        const newScale = Math.max(
            ANIMATION_CONSTANTS.MIN_SCALE,
            Math.min(ANIMATION_CONSTANTS.MAX_SCALE, this.state.targetScale + delta)
        );

        this.state.targetScale = newScale;
        this.state.lastInteractionTime = Date.now();
    }

    adjustToGround(model: Group): void {
        model.updateMatrixWorld(true);
        const box = new Box3().setFromObject(model);
        const minZ = box.min.z;
        if (minZ !== 0) {
            model.position.z -= minZ;
            model.updateMatrixWorld(true);
        }
    }

    setPosition(x: number, y: number, z: number): void {
        // If we have a selected model/mesh, invoke updating its position
        if (this.state.model) {
            // Updating directly for now, usually we might want to animate this
            // Preserve current Z if input z is 0 (default) to respect adjustToGround
            const targetZ = z === 0 ? this.state.model.position.z : z;

            this.state.model.position.set(x, y, targetZ);
            this.state.model.updateMatrixWorld(true);

            // Sync with targetPosition if used for animations
            this.state.targetPosition = new Vector3(x, y, targetZ);
        }
    }

    reset(): void {
        if (!this.state.selected) return;
        this.state.targetRotation = new Euler(0, 0, 0);
        this.state.targetScale = 1;
        this.state.lastInteractionTime = Date.now();

        const bounds = this.state.modelBounds;
        if (bounds) {
            const center = new Vector3();
            // @ts-ignore
            bounds.box.getCenter(center);
            this.state.targetPosition = new Vector3(0, 0, Math.max(0, center.z));
        }
    }
};
