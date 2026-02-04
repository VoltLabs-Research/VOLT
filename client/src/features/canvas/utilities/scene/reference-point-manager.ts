import { Box3, Group, Vector3 } from 'three';
import type { ExtendedSceneState } from '@/features/canvas/types';

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

        this.state.initialTransform ={
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
