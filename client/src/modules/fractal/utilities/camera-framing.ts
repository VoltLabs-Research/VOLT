import {
    Box3,
    MathUtils,
    OrthographicCamera,
    PerspectiveCamera,
    Scene,
    Sphere,
    Vector3
} from 'three';

import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { Camera } from 'three';

export type CameraAnglePreset =
    | 'current'
    | 'front'
    | 'back'
    | 'left'
    | 'right'
    | 'top'
    | 'bottom'
    | 'isometric'
    | 'ground-isometric';

export interface CaptureBounds {
    box: Box3;
    center: Vector3;
    boundingSphere: Sphere;
}

export interface ViewBasis {
    forward: Vector3;
    right: Vector3;
    up: Vector3;
}

interface CameraControlsTarget {
    target: Vector3;
    minDistance?: number;
    update: () => void;
}

interface ApplyCameraAnglePresetOptions {
    anglePreset: CameraAnglePreset;
    camera: Camera;
    sceneUp: Vector3;
    target: Vector3;
    captureBounds?: CaptureBounds | null;
    controls?: CameraControlsTarget | null;
    fallbackDistance?: number;
}

export const FRAMING_CAPTURE_TARGET_KEY = 'isScreenshotCaptureTarget';
export const FRAMING_PADDING = 1.15;

export const getAngleDirection = (anglePreset: CameraAnglePreset): Vector3 | null => {
    switch (anglePreset) {
        case 'front':
            return new Vector3(0, -1, 0);
        case 'back':
            return new Vector3(0, 1, 0);
        case 'left':
            return new Vector3(-1, 0, 0);
        case 'right':
            return new Vector3(1, 0, 0);
        case 'top':
            return new Vector3(0, 0, 1);
        case 'bottom':
            return new Vector3(0, 0, -1);
        case 'isometric':
            return new Vector3(1, -1, 0.85).normalize();
        case 'ground-isometric':
            return new Vector3(1, -1, 0).normalize();
        case 'current':
        default:
            return null;
    }
};

export const getAngleUpVector = (anglePreset: CameraAnglePreset, sceneUp: Vector3): Vector3 => {
    if (anglePreset === 'top') {
        return new Vector3(0, 1, 0);
    }

    if (anglePreset === 'bottom') {
        return new Vector3(0, -1, 0);
    }

    return sceneUp.clone();
};

export const getBoxCorners = (box: Box3): Vector3[] => {
    const { min, max } = box;
    return [
        new Vector3(min.x, min.y, min.z),
        new Vector3(min.x, min.y, max.z),
        new Vector3(min.x, max.y, min.z),
        new Vector3(min.x, max.y, max.z),
        new Vector3(max.x, min.y, min.z),
        new Vector3(max.x, min.y, max.z),
        new Vector3(max.x, max.y, min.z),
        new Vector3(max.x, max.y, max.z)
    ];
};

export const resolveViewBasis = (direction: Vector3, preferredUp: Vector3): ViewBasis => {
    const forward = direction.clone().negate().normalize();
    let up = preferredUp.clone().normalize();

    if (Math.abs(forward.dot(up)) > 0.999) {
        up = Math.abs(forward.z) < 0.999
            ? new Vector3(0, 0, 1)
            : new Vector3(0, 1, 0);
    }

    const right = new Vector3().crossVectors(forward, up).normalize();
    up = new Vector3().crossVectors(right, forward).normalize();

    return { forward, right, up };
};

export const getFallbackBoxFromModelWorldBounds = (modelWorldBounds?: ModelWorldBounds | null): Box3 | null => {
    if (!modelWorldBounds) {
        return null;
    }

    return new Box3(
        new Vector3(modelWorldBounds.min.x, modelWorldBounds.min.y, modelWorldBounds.min.z),
        new Vector3(modelWorldBounds.max.x, modelWorldBounds.max.y, modelWorldBounds.max.z)
    );
};

export const getCaptureBounds = (
    scene: Scene,
    modelWorldBounds?: ModelWorldBounds | null,
    framingBoundsWorld?: ModelWorldBounds | null
): CaptureBounds | null => {
    const explicitFramingBox = getFallbackBoxFromModelWorldBounds(framingBoundsWorld);
    if (explicitFramingBox && !explicitFramingBox.isEmpty()) {
        const center = explicitFramingBox.getCenter(new Vector3());
        const boundingSphere = explicitFramingBox.getBoundingSphere(new Sphere());

        return {
            box: explicitFramingBox,
            center,
            boundingSphere
        };
    }

    const bounds = new Box3();
    let hasBounds = false;

    scene.traverse((object) => {
        if (!object.userData?.[FRAMING_CAPTURE_TARGET_KEY]) {
            return;
        }

        const objectBounds = new Box3().setFromObject(object);
        if (objectBounds.isEmpty()) {
            return;
        }

        if (!hasBounds) {
            bounds.copy(objectBounds);
            hasBounds = true;
            return;
        }

        bounds.union(objectBounds);
    });

    if (!hasBounds) {
        const fallbackBounds = getFallbackBoxFromModelWorldBounds(modelWorldBounds);
        if (!fallbackBounds || fallbackBounds.isEmpty()) {
            return null;
        }

        bounds.copy(fallbackBounds);
    }

    const center = bounds.getCenter(new Vector3());
    const boundingSphere = bounds.getBoundingSphere(new Sphere());

    return {
        box: bounds,
        center,
        boundingSphere
    };
};

export const resolvePerspectiveDistance = (
    bounds: CaptureBounds,
    basis: ViewBasis,
    camera: PerspectiveCamera,
    minDistance: number
): number => {
    const verticalHalfFov = MathUtils.degToRad(camera.getEffectiveFOV()) / 2;
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
    const tanVertical = Math.tan(verticalHalfFov);
    const tanHorizontal = Math.tan(horizontalHalfFov);
    const corners = getBoxCorners(bounds.box);

    let requiredDistance = 0;

    corners.forEach((corner) => {
        const offset = corner.sub(bounds.center);
        const x = Math.abs(offset.dot(basis.right));
        const y = Math.abs(offset.dot(basis.up));
        const z = offset.dot(basis.forward);

        requiredDistance = Math.max(
            requiredDistance,
            x / tanHorizontal - z,
            y / tanVertical - z
        );
    });

    return Math.max(
        minDistance,
        bounds.boundingSphere.radius * 1.1,
        requiredDistance * FRAMING_PADDING,
        1
    );
};

export const resolveOrthographicFraming = (
    bounds: CaptureBounds,
    basis: ViewBasis,
    camera: OrthographicCamera,
    minDistance: number
): { distance: number; zoom: number } => {
    const corners = getBoxCorners(bounds.box);
    let maxX = 0;
    let maxY = 0;
    let minZ = Number.POSITIVE_INFINITY;

    corners.forEach((corner) => {
        const offset = corner.sub(bounds.center);
        maxX = Math.max(maxX, Math.abs(offset.dot(basis.right)));
        maxY = Math.max(maxY, Math.abs(offset.dot(basis.up)));
        minZ = Math.min(minZ, offset.dot(basis.forward));
    });

    const paddedWidth = Math.max(maxX * 2 * FRAMING_PADDING, 1e-3);
    const paddedHeight = Math.max(maxY * 2 * FRAMING_PADDING, 1e-3);
    const frustumWidth = camera.right - camera.left;
    const frustumHeight = camera.top - camera.bottom;
    const widthZoom = frustumWidth / paddedWidth;
    const heightZoom = frustumHeight / paddedHeight;
    const zoom = Math.max(0.0001, Math.min(widthZoom, heightZoom));
    const distance = Math.max(
        minDistance,
        camera.near - minZ + 1,
        bounds.boundingSphere.radius * 2,
        1
    );

    return { distance, zoom };
};

export const applyCameraAnglePreset = ({
    anglePreset,
    camera,
    sceneUp,
    target,
    captureBounds,
    controls,
    fallbackDistance = 8
}: ApplyCameraAnglePresetOptions): boolean => {
    const direction = getAngleDirection(anglePreset);
    if (!direction) {
        return false;
    }

    const minDistance = controls?.minDistance ?? 0.1;
    const basis = resolveViewBasis(direction, getAngleUpVector(anglePreset, sceneUp));
    let distance = Math.max(minDistance, 1);

    if (captureBounds && camera instanceof PerspectiveCamera) {
        distance = resolvePerspectiveDistance(captureBounds, basis, camera, minDistance);
    } else if (captureBounds && camera instanceof OrthographicCamera) {
        const orthographicFraming = resolveOrthographicFraming(captureBounds, basis, camera, minDistance);
        distance = orthographicFraming.distance;
        camera.zoom = orthographicFraming.zoom;
    } else {
        distance = Math.max(minDistance, fallbackDistance);
    }

    camera.position.copy(target.clone().addScaledVector(direction, distance));
    camera.up.copy(basis.up);

    if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
        camera.updateProjectionMatrix();
    }

    if (controls) {
        controls.target.copy(target);
        controls.update();
    } else {
        camera.lookAt(target);
    }

    return true;
};
