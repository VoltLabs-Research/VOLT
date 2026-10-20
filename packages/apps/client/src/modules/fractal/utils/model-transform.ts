import { Box3, Vector3, Sphere, Group, Object3D } from 'three';

interface ObjectWithOptionalScene extends Object3D {
    scene?: Object3D;
}

interface TransformVector {
    x: number;
    y: number;
    z: number;
}

interface ModelTransformParams {
    position: TransformVector;
    rotation: TransformVector;
    scale: number;
    disableAutoTransform?: boolean;
    useFixedReference?: boolean;
}

export type BoundsInfo = {
    box: Box3;
    size: Vector3;
    center: Vector3;
    boundingSphere: Sphere;
    maxDimension: number;
};

export class ModelTransform {
    private referenceScaleFactor?: number;

    static boundsFromObject(obj: ObjectWithOptionalScene): BoundsInfo {
        const box = new Box3().setFromObject(obj.scene ?? obj);
        const size = new Vector3();
        const center = new Vector3();
        box.getSize(size);
        box.getCenter(center);

        const boundingSphere = new Sphere();
        box.getBoundingSphere(boundingSphere);

        return {
            box,
            size,
            center,
            boundingSphere,
            maxDimension: Math.max(size.x, size.y, size.z)
        };
    }

    static optimalTransforms(bounds: BoundsInfo) {
        const { size, center, maxDimension } = bounds;
        const targetSize = 8;
        let scale = 1;
        if (maxDimension > 0) {
            scale = targetSize / maxDimension;
        }

        const shouldRotate = size.y > size.z * 1.2 || size.z < Math.min(size.x, size.y) * 0.8;
        let rotation: TransformVector = {
            x: 0,
            y: 0,
            z: 0
        };
        if (shouldRotate) {
            rotation = {
                x: Math.PI / 2,
                y: 0,
                z: 0
            };
        }

        const position = {
            x: -center.x * scale,
            y: -center.y * scale,
            z: -center.z * scale
        };

        return {
            position,
            rotation,
            scale
        };
    }

    apply(model: Group, params: ModelTransformParams) {
        const bounds = ModelTransform.boundsFromObject(model);

        if (params.disableAutoTransform) {
            return bounds;
        }

        if (!params.useFixedReference) {
            const optimal = ModelTransform.optimalTransforms(bounds);
            model.position.set(
                params.position.x + optimal.position.x,
                params.position.y + optimal.position.y,
                params.position.z + optimal.position.z
            );
            model.scale.setScalar(params.scale * optimal.scale);
        } else {
            if (this.referenceScaleFactor == null) {
                const { scale: scaleRef } = ModelTransform.optimalTransforms(bounds);
                this.referenceScaleFactor = scaleRef;
            }

            model.scale.setScalar(params.scale * (this.referenceScaleFactor || 1));
            model.position.set(params.position.x, params.position.y, params.position.z);
            model.rotation.set(params.rotation.x, params.rotation.y, params.rotation.z);
        }

        model.updateMatrixWorld(true);
        return ModelTransform.boundsFromObject(model);
    }
}
