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
        }else if('clippingPlanes' in(material as any)){
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
