/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import { ShaderMaterial, Group, Points, WebGLRenderer, Material, Plane } from 'three';

export default class ClippingManager{
    constructor(
        private gl: WebGLRenderer | null,
        private invalidate: () => void
    ){}

    applyToMaterial(material: Material, planes: Plane[]){
        if(material instanceof ShaderMaterial){
            if(this.gl){
                this.gl.localClippingEnabled = planes.length > 0;
            }

            material.clipping = planes.length > 0;
            material.clippingPlanes = planes.length > 0 ? planes : null;
            material.needsUpdate = true;

            if(material.uniforms && material.uniforms.clippingPlanes){
                material.uniforms.clippingPlanes.value = planes;
                material.uniformsNeedUpdate = true;
            }
        }else if('clippingPlanes' in (material as any)){
            material.clippingPlanes = planes;
            material.needsUpdate = true;
        }
    }
    
    applyToModel(root: Group | null, planes: Plane[]){
        if(!root) return;
        if(this.gl){
            this.gl.localClippingEnabled = planes.length > 0;
        }

        root.traverse((obj: any) => {
            if(!obj.material) return;

            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((material: Material) => {
                this.applyToMaterial(material, planes);
                
                if(obj instanceof Points && material instanceof ShaderMaterial){
                    material.needsUpdate = true;
                    obj.geometry.attributes.position.needsUpdate = true;
                }
            });
        });

        this.invalidate();
    }

    setLocalClippingEnabled(enabled: boolean): void{
        if(this.gl){
            this.gl.localClippingEnabled = enabled;
        }
    }
};