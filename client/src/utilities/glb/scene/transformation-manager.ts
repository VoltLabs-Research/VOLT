/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
import { Euler, Box3, Group, Vector3 } from 'three';
import { ANIMATION_CONSTANTS } from '@/utilities/glb/simulation-box';

export default class TransformationManager{
    constructor(
        private state: ExtendedSceneState
    ){}

    rotate(dx: number, dy: number, dz: number): void{
        if(!this.state.selected) return;

        const r = this.state.currentRotation.clone();
        r.x += dx;
        r.y += dy;
        r.z += dz;

        this.state.targetRotation = r;
        this.state.lastInteractionTime = Date.now();
    }

    scale(delta: number): void{
        if(!this.state.selected) return;

        const newScale = Math.max(
            ANIMATION_CONSTANTS.MIN_SCALE,
            Math.min(ANIMATION_CONSTANTS.MAX_SCALE, this.state.targetScale + delta)
        );

        this.state.targetScale = newScale;
        this.state.lastInteractionTime = Date.now();
    }

    adjustToGround(model: Group): void{
        model.updateMatrixWorld(true);
        const box = new Box3().setFromObject(model);
        const minZ = box.min.z;
        if(minZ !== 0){
            model.position.z -= minZ;
            model.updateMatrixWorld(true);
        }
    }

    reset(): void{
        if(!this.state.selected) return;
        this.state.targetRotation = new Euler(0, 0, 0);
        this.state.targetScale = 1;
        this.state.lastInteractionTime = Date.now();

        const bounds = this.state.modelBounds;
        if(bounds){
            const center = new Vector3();
            // @ts-ignore
            bounds.box.getCenter(center);
            this.state.targetPosition = new Vector3(0, 0, Math.max(0, center.z));
        }
    }
};