import * as THREE from 'three';

const DEFAULT_CAMERA_DIRECTION = new THREE.Vector3(1, 1, 0.75).normalize();
const DEFAULT_PADDING_MULTIPLIER = 1.2;

export interface PerspectiveCameraFitControls {
    target: THREE.Vector3;
    minDistance: number;
    maxDistance: number;
    update?: () => void;
}

interface FitPerspectiveCameraOptions {
    paddingMultiplier?: number;
    updateClipping?: boolean;
    fallbackTarget?: THREE.Vector3;
}

export const fitPerspectiveCameraToBox = (
    camera: THREE.PerspectiveCamera,
    worldBox: THREE.Box3,
    controls?: PerspectiveCameraFitControls | null,
    options: FitPerspectiveCameraOptions = {}
) => {
    if (worldBox.isEmpty()) {
        return;
    }

    const sphere = worldBox.getBoundingSphere(new THREE.Sphere());
    const nextTarget = sphere.center.clone();
    const referenceTarget = controls?.target ?? options.fallbackTarget ?? nextTarget;
    const currentDirection = camera.position.clone().sub(referenceTarget);
    const direction = currentDirection.lengthSq() > 0.0001
        ? currentDirection.normalize()
        : DEFAULT_CAMERA_DIRECTION;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const fitFov = Math.min(verticalFov, horizontalFov);
    const desiredDistance = (sphere.radius / Math.sin(fitFov / 2)) * (options.paddingMultiplier ?? DEFAULT_PADDING_MULTIPLIER);
    const distance = controls
        ? Math.min(controls.maxDistance, Math.max(controls.minDistance, desiredDistance))
        : desiredDistance;

    controls?.target.copy(nextTarget);
    camera.position.copy(nextTarget.clone().addScaledVector(direction, distance));

    if (options.updateClipping) {
        camera.near = 0.01;
        camera.far = Math.max(1000, distance + (sphere.radius * 8));
        camera.lookAt(nextTarget);
    }

    camera.updateProjectionMatrix();
    controls?.update?.();
};
