import { Box3, Vector3, Sphere, MathUtils, Group } from 'three';

export type BoundsInfo = {
    box: Box3;
    size: Vector3;
    center: Vector3;
    boundingSphere: Sphere;
    maxDimension: number;
};

export class ModelTransform {
    private referenceScaleFactor?: number;
    private useFixedReference = false;

    static boundsFromObject(obj: any): BoundsInfo {
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
        const scale = maxDimension > 0 ? targetSize / maxDimension : 1;

        const shouldRotate = size.y > size.z * 1.2 || size.z < Math.min(size.x, size.y) * 0.8;
        const rotation = shouldRotate ? { x: Math.PI / 2, y: 0, z: 0 } : { x: 0, y: 0, z: 0 };

        const position = {
            x: -center.x * scale,
            y: -center.y * scale,
            z: -center.z * scale
        };

        return { position, rotation, scale };
    }

    static closestCameraPositionZY(bounds: Box3, camera: any) {
        const center = bounds.getCenter(new Vector3());
        const size = bounds.getSize(new Vector3());

        const viewHeight = size.z;
        const viewWidth = size.y;
        const fovRad = MathUtils.degToRad(camera.fov);

        const distByHeight = (viewHeight / 2) / Math.tan(fovRad / 2);
        const distByWidth = (viewWidth / 2) / (Math.tan(fovRad / 2) * camera.aspect);

        let distance = Math.max(distByHeight, distByWidth);
        distance *= 1.01;

        return {
            position: new Vector3(center.x + distance, center.y, center.z),
            target: center.clone(),
            up: new Vector3(0, 0, 1)
        };
    }

    apply(model: Group, params: {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: number;
        disableAutoTransform?: boolean;
        useFixedReference?: boolean;
    }) {
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
            this.useFixedReference = true;
        }

        model.updateMatrixWorld(true);
        return ModelTransform.boundsFromObject(model);
    }
}
