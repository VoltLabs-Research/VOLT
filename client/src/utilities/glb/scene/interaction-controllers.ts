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

import type { ExtendedSceneState } from '@/types/canvas';
import { Camera, Scene, WebGLRenderer, Raycaster, Plane } from 'three';
import { attachPointerEvents, attachKeyboard } from '@/utilities/glb/interaction';
import SelectionManager from '@/utilities/glb/scene/selection-manager';
import TransformationManager from '@/utilities/glb/scene/transformation-manager';

export default class InteractionController {
    constructor(
        private state: ExtendedSceneState,
        private camera: Camera,
        private scene: Scene,
        private gl: WebGLRenderer,
        private raycaster: Raycaster,
        private groundPlane: Plane,
        private selectionManager: SelectionManager,
        private transformManager: TransformationManager,

        private detachPointer?: () => void,
        private detachKeyboard?: () => void,
        private onSelect?: () => void,
        private orbitControlsRef?: any
    ) { }

    setCamera(camera: Camera): void {
        this.camera = camera;
    }


    attach(): void {
        if (!this.gl.domElement) return;

        this.detachPointer = attachPointerEvents({
            glCanvas: this.gl.domElement,
            camera: this.camera,
            scene: this.scene,
            raycaster: this.raycaster,
            groundPlane: this.groundPlane,
            // @ts-ignore
            state: this.state,
            showSelectionBox: (hover) => this.selectionManager.show(!!hover),
            hideSelectionBox: () => this.selectionManager.hide(),
            deselect: () => this.selectionManager.deselect(),
            onSelect: this.onSelect,
            setOrbitControlsEnabled: (enabled) => {
                if (this.orbitControlsRef?.current) {
                    this.orbitControlsRef.current.enabled = enabled;
                }
            }
        });

        this.detachKeyboard = attachKeyboard({
            // @ts-ignore
            state: this.state,
            rotateModel: (dx, dy, dz) => this.transformManager.rotate(dx, dy, dz),
            scaleModel: (delta) => this.transformManager.scale(delta),
            deselect: () => this.selectionManager.deselect()
        });
    }

    detach(): void {
        this.detachPointer?.();
        this.detachKeyboard?.();
    }
};
