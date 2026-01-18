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

import { Group, Scene, MeshBasicMaterial, Object3D } from 'three';
import type { ExtendedSceneState } from '@/features/canvas/types';

export default class ResourceManager {
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private invalidate: () => void
    ){}

    cleanup(): void {
        this.cleanupModels();
        this.cleanupSelection();
        this.cleanupSimulationBox();
        this.resetState();
        this.invalidate();
    }

    private cleanupModels(): void {
        if (this.state.model) {
            this.scene.remove(this.state.model);
            this.state.model = null;
        }
    }

    swapModel(activeModel: Object3D | null, newModel: Object3D): void {
        // Scene graph manipulation is now handled by React via <primitive />
        this.state.model = newModel as Group;
    }

    private cleanupSelection(): void {
        if (this.state.selection) {
            this.scene.remove(this.state.selection.group)
            this.state.selection = null;
        }
    }

    private cleanupSimulationBox(): void {
        if (this.state.simBoxMesh) {
            this.scene.remove(this.state.simBoxMesh);
            this.state.simBoxMesh.geometry.dispose();
            (this.state.simBoxMesh.material as MeshBasicMaterial).dispose();
            this.state.simBoxMesh = null;
            this.state.simBoxSize = null;
            this.state.simBoxBaseSize = null;
        }
    }

    private resetState(): void {
        this.state.model = null;
        this.state.mesh = null;
        this.state.isSetup = false;
        this.state.selected = null;
        this.state.isSelectedPersistent = false;
        this.state.isRotating = false;
        this.state.rotationFreezeSize = null;
        this.state.sizeAnimActive = false;
        this.state.referenceScaleFactor = undefined;
        this.state.fixedReferencePoint = null;
        this.state.useFixedReference = false;
        this.state.initialTransform = null;
    }
};
