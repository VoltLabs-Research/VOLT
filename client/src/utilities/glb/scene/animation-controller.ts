/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Scene, Camera, Box3, Vector3, Points, ShaderMaterial, EdgesGeometry, MeshBasicMaterial } from 'three';
import { ANIMATION_CONSTANTS, ensureSimulationBox, startSizeAnimAfterRotation, runSizeAnimationStep } from '@/utilities/glb/simulation-box';
import { updateSelectionGeometry } from '@/utilities/glb/selection';
import type { ExtendedSceneState } from '@/types/canvas';

// Reuse these to avoid GC pressure
const _box = new Box3();
const _center = new Vector3();

export default class AnimationController {
    private needsInvalidate = false;

    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private camera: Camera,
        private invalidate: () => void
    ) { }

    update(): void {
        if (!this.state.model) return;

        const now = Date.now();
        this.needsInvalidate = false;

        this.updateCameraUniforms();
        this.updateSimulationBox();
        this.updateDrag();
        this.updateRotation(now);
        this.updateScale();
        this.updateSizeAnimation(now);
        this.updateSelection(now);

        // Single invalidate call per frame instead of multiple
        if (this.needsInvalidate) {
            this.invalidate();
        }
    }

    private updateCameraUniforms(): void {
        const { mesh } = this.state;
        if (mesh && mesh instanceof Points && mesh.material instanceof ShaderMaterial) {
            if (mesh.material.uniforms?.cameraPosition) {
                mesh.material.uniforms.cameraPosition.value.copy(this.camera.position);
            }
        }
    }

    private updateSimulationBox(): void {
        if (!this.state.model) return;

        // Reuse box object
        _box.setFromObject(this.state.model);
        _box.getCenter(_center);

        // @ts-ignore
        ensureSimulationBox(this.state, this.scene, _box);
        if (this.state.simBoxMesh) {
            this.state.simBoxMesh.position.copy(_center);
        }
    }

    private updateDrag(): void {
        if (this.state.selected && this.state.targetPosition) {
            this.state.targetPosition.z = Math.max(0, this.state.targetPosition.z);
            this.state.selected.position.lerp(
                this.state.targetPosition,
                ANIMATION_CONSTANTS.POSITION_LERP_SPEED
            );
            this.needsInvalidate = true;
        }
    }

    private updateRotation(now: number): void {
        if (!this.state.selected || !this.state.targetRotation) return;

        const f = ANIMATION_CONSTANTS.ROTATION_LERP_SPEED;
        this.state.currentRotation.x += (this.state.targetRotation.x - this.state.currentRotation.x) * f;
        this.state.currentRotation.y += (this.state.targetRotation.y - this.state.currentRotation.y) * f;
        this.state.currentRotation.z += (this.state.targetRotation.z - this.state.currentRotation.z) * f;
        this.state.selected.rotation.copy(this.state.currentRotation);
        this.needsInvalidate = true;

        const dx = Math.abs(this.state.targetRotation.x - this.state.currentRotation.x);
        const dy = Math.abs(this.state.targetRotation.y - this.state.currentRotation.y);
        const dz = Math.abs(this.state.targetRotation.z - this.state.currentRotation.z);
        const rotatingNow = dx + dy + dz > ANIMATION_CONSTANTS.ROT_EPS;

        if (rotatingNow) {
            this.handleActiveRotation();
            this.state.isRotating = true;
            this.state.lastRotationActiveMs = now;
        } else {
            this.handleRotationSettle(now);
        }
    }

    private handleActiveRotation(): void {
        if (this.state.isRotating) return;

        if (this.state.selection) {
            const baseGeo = this.state.selection.base.geometry as EdgesGeometry;
            baseGeo.computeBoundingBox();
            const curBB = baseGeo.boundingBox!;
            const curSize = new Vector3();
            curBB.getSize(curSize);
            this.state.rotationFreezeSize = curSize.clone();
        }

        if (this.state.sizeAnimActive) {
            this.state.sizeAnimActive = false;

            if (this.state.sizeAnimTo && this.state.selection) {
                updateSelectionGeometry(
                    this.state.selection,
                    this.state.sizeAnimTo.clone(),
                    this.state.isHovered && !this.state.isSelectedPersistent
                );
            }

            if (this.state.sizeAnimTo &&
                this.state.simBoxMesh &&
                this.state.simBoxBaseSize) {
                const target = this.state.sizeAnimTo;
                const base = this.state.simBoxBaseSize;
                this.state.simBoxMesh.scale.set(
                    target.x / base.x,
                    target.y / base.y,
                    target.z / base.z
                );
                this.state.simBoxSize = target.clone();
            }
        }
    }

    private handleRotationSettle(now: number) {
        if (this.state.isRotating &&
            now - this.state.lastRotationActiveMs >= ANIMATION_CONSTANTS.ROTATION_SETTLE_MS) {
            this.state.isRotating = false;
            // @ts-ignore
            startSizeAnimAfterRotation(this.state, this.scene, now);
        }
    }

    private updateScale(): void {
        if (!this.state.selected) return;

        if (Math.abs(this.state.targetScale - this.state.currentScale) > 1e-3) {
            const newScale = this.state.currentScale +
                (this.state.targetScale - this.state.currentScale) * ANIMATION_CONSTANTS.SCALE_LERP_SPEED;
            this.state.selected.scale.setScalar(newScale);
            this.state.currentScale = newScale;
            this.needsInvalidate = true;
        }
    }

    private updateSizeAnimation(now: number): void {
        // @ts-ignore
        if (runSizeAnimationStep(this.state, now)) {
            this.needsInvalidate = true;
        }
    }

    private updateSelection(now: number): void {
        if (!this.state.selection || !this.state.model) return;

        const hover = this.state.isHovered && !this.state.isSelectedPersistent;

        // Reuse cached center from updateSimulationBox
        this.state.selection.group.position.lerp(_center, ANIMATION_CONSTANTS.SELECTION_LERP_SPEED);

        const timeSince = (now - this.state.lastInteractionTime) / 1000;
        const pulseI = Math.max(0, 1 - timeSince * 0.5);
        const pulse = 0.7 + 0.3 * Math.sin(now * ANIMATION_CONSTANTS.PULSE_SPEED) * pulseI;

        const material = this.state.selection.base.material as MeshBasicMaterial;
        material.opacity = (hover ? 0.9 : 0.75) * (0.9 + 0.1 * pulse);

        const target = this.state.showSelection || this.state.isHovered ? 1 : 0.001;
        const curScale = this.state.selection.group.scale.x || 1;
        const next = curScale + (target - curScale) * ANIMATION_CONSTANTS.SELECTION_LERP_SPEED;
        this.state.selection.group.scale.setScalar(next);

        if (!this.state.showSelection && !this.state.isHovered && next < 0.01) {
            this.scene.remove(this.state.selection.group);
            this.state.selection = null;
        }

        this.needsInvalidate = true;
    }
}
