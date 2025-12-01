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

import { Box3, Group, Vector3 } from 'three';
import type { ExtendedSceneState } from '@/types/canvas';

export default class ReferencePointManager{
    constructor(
        private state: ExtendedSceneState
    ){}

    setFixedReference(
        model: Group,
        refType: 'origin' | 'initial' | 'custom' = 'initial',
        customPoint?: Vector3
    ): void{
        switch(refType){
            case 'origin':
                this.state.fixedReferencePoint = new Vector3(0, 0, 0);
                break;
            case 'custom':
                this.state.fixedReferencePoint = customPoint ? customPoint.clone() : new Vector3(0, 0, 0);
                break;
            case 'initial':
            default:
                const initialBox = new Box3().setFromObject(model);
                const center = new Vector3();
                initialBox.getCenter(center);
                this.state.fixedReferencePoint = center.clone();
                break;
        }

        this.state.initialTransform = {
            position: model.position.clone(),
            rotation: model.rotation.clone(),
            scale: model.scale.x
        };
    }

    getFixedReferencePoint(){
        return this.state.fixedReferencePoint;
    }

    hasFixedReference(): boolean{
        return !!this.state.useFixedReference;
    } 
};
