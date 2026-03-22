import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import { resolveScreenshotScale, resolveScreenshotSize } from '@/modules/canvas/utilities/screenshot';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { sileo } from 'sileo';
import {
    Box3,
    MathUtils,
    OrthographicCamera,
    PerspectiveCamera,
    Points,
    Scene,
    ShaderMaterial,
    Sphere,
    Vector3
} from 'three';

import type { ScreenshotRequest } from '@/modules/canvas/utilities/screenshot';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { MutableRefObject } from 'react';

interface ScreenshotCaptureProps {
    captureRequest?: ScreenshotRequest | null;
    onCaptureHandled: () => void;
    onStatusChange?: (message: string) => void;
    orbitRef?: MutableRefObject<OrbitControlsHandle | null>;
    modelWorldBounds?: ModelWorldBounds | null;
};

interface ScreenshotViewSnapshot {
    position: Vector3;
    target: Vector3;
    up: Vector3;
    zoom: number;
}

interface PendingCapture {
    framesRemaining: number;
    originalDpr: number;
    originalSize: { width: number; height: number };
    originalBufferSize: { width: number; height: number };
    requestedSize: { width: number; height: number };
    pointCloudScaleSnapshot: Array<{ material: ShaderMaterial; pointScale: number }>;
    snapshot: ScreenshotViewSnapshot;
    captureInFlight: boolean;
}

interface CaptureBounds {
    box: Box3;
    center: Vector3;
    boundingSphere: Sphere;
}

interface ViewBasis {
    forward: Vector3;
    right: Vector3;
    up: Vector3;
}

const SCREENSHOT_CAPTURE_TARGET_KEY = 'isScreenshotCaptureTarget';
const SCREENSHOT_CAPTURE_PADDING = 1.15;

const canvasToBlob = (canvas: HTMLCanvasElement) => {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas capture returned an empty blob.'));
                return;
            }

            resolve(blob);
        }, 'image/png');
    });
};

const getAngleDirection = (anglePreset: ScreenshotRequest['anglePreset']) => {
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
        case 'current':
        default:
            return null;
    }
};

const getAngleUpVector = (anglePreset: ScreenshotRequest['anglePreset'], sceneUp: Vector3) => {
    if (anglePreset === 'top') {
        return new Vector3(0, 1, 0);
    }

    if (anglePreset === 'bottom') {
        return new Vector3(0, -1, 0);
    }

    return sceneUp.clone();
};

const getBoxCorners = (box: Box3) => {
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

const resolveViewBasis = (direction: Vector3, preferredUp: Vector3): ViewBasis => {
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

const getFallbackBoxFromModelWorldBounds = (modelWorldBounds?: ModelWorldBounds | null) => {
    if (!modelWorldBounds) {
        return null;
    }

    return new Box3(
        new Vector3(modelWorldBounds.min.x, modelWorldBounds.min.y, modelWorldBounds.min.z),
        new Vector3(modelWorldBounds.max.x, modelWorldBounds.max.y, modelWorldBounds.max.z)
    );
};

const getCaptureBounds = (
    scene: Scene,
    modelWorldBounds?: ModelWorldBounds | null
): CaptureBounds | null => {
    const bounds = new Box3();
    let hasBounds = false;

    scene.traverse((object) => {
        if (!object.userData?.[SCREENSHOT_CAPTURE_TARGET_KEY]) {
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

const resolvePerspectiveDistance = (
    bounds: CaptureBounds,
    basis: ViewBasis,
    camera: PerspectiveCamera,
    minDistance: number
) => {
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
        requiredDistance * SCREENSHOT_CAPTURE_PADDING,
        1
    );
};

const resolveOrthographicFraming = (
    bounds: CaptureBounds,
    basis: ViewBasis,
    camera: OrthographicCamera,
    minDistance: number
) => {
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

    const paddedWidth = Math.max(maxX * 2 * SCREENSHOT_CAPTURE_PADDING, 1e-3);
    const paddedHeight = Math.max(maxY * 2 * SCREENSHOT_CAPTURE_PADDING, 1e-3);
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

const scalePointCloudMaterials = (
    scene: Scene,
    scale: number
): Array<{ material: ShaderMaterial; pointScale: number }> => {
    const snapshot: Array<{ material: ShaderMaterial; pointScale: number }> = [];

    if (Math.abs(scale - 1) < 1e-3) {
        return snapshot;
    }

    scene.traverse((object) => {
        const material = object instanceof Points ? object.material : null;
        if (!(material instanceof ShaderMaterial) || !material.uniforms?.pointScale) {
            return;
        }

        const pointScale = material.uniforms.pointScale.value;
        if (typeof pointScale !== 'number') {
            return;
        }

        snapshot.push({ material, pointScale });
        material.uniforms.pointScale.value = pointScale * scale;
    });

    return snapshot;
};

const restorePointCloudMaterials = (
    snapshot: Array<{ material: ShaderMaterial; pointScale: number }>
) => {
    snapshot.forEach(({ material, pointScale }) => {
        if (material.uniforms?.pointScale) {
            material.uniforms.pointScale.value = pointScale;
        }
    });
};

const ScreenshotCapture = ({
    captureRequest,
    onCaptureHandled,
    onStatusChange,
    orbitRef,
    modelWorldBounds
}: ScreenshotCaptureProps) => {
    const { gl, scene, camera, invalidate, setDpr, setSize, size } = useThree();
    const pendingRef = useRef<PendingCapture | null>(null);
    const toastIdRef = useRef<string | null>(null);
    const sizeRef = useRef({ width: size.width, height: size.height });

    useEffect(() => {
        sizeRef.current = { width: size.width, height: size.height };
    }, [size.height, size.width]);

    const dismissToast = useCallback(() => {
        if (!toastIdRef.current) {
            return;
        }

        sileo.dismiss(toastIdRef.current);
        toastIdRef.current = null;
    }, []);

    const getSnapshot = useCallback((): ScreenshotViewSnapshot => {
        const controls = orbitRef?.current;
        return {
            position: camera.position.clone(),
            target: controls?.target.clone() ?? new Vector3(0, 0, 0),
            up: camera.up.clone(),
            zoom: 'zoom' in camera && typeof camera.zoom === 'number' ? camera.zoom : 1
        };
    }, [camera, orbitRef]);

    const restoreSnapshot = useCallback((snapshot: ScreenshotViewSnapshot) => {
        const controls = orbitRef?.current;
        camera.position.copy(snapshot.position);
        camera.up.copy(snapshot.up);

        if ('zoom' in camera && typeof camera.zoom === 'number') {
            camera.zoom = snapshot.zoom;
        }

        if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
            camera.updateProjectionMatrix();
        }

        if (controls) {
            controls.target.copy(snapshot.target);
            controls.update();
        } else {
            camera.lookAt(snapshot.target);
        }
    }, [camera, orbitRef]);

    const applyAnglePreset = useCallback((request: ScreenshotRequest) => {
        const direction = getAngleDirection(request.anglePreset);
        if (!direction) {
            return;
        }

        const controls = orbitRef?.current;
        const captureBounds = getCaptureBounds(scene, modelWorldBounds);
        const target = captureBounds?.center.clone() ?? controls?.target.clone() ?? new Vector3(0, 0, 0);
        const basis = resolveViewBasis(direction, getAngleUpVector(request.anglePreset, scene.up));

        let distance = Math.max(controls?.minDistance ?? 0.1, 1);

        if (captureBounds && camera instanceof PerspectiveCamera) {
            distance = resolvePerspectiveDistance(captureBounds, basis, camera, controls?.minDistance ?? 0.1);
        } else if (captureBounds && camera instanceof OrthographicCamera) {
            const orthographicFraming = resolveOrthographicFraming(captureBounds, basis, camera, controls?.minDistance ?? 0.1);
            distance = orthographicFraming.distance;
            camera.zoom = orthographicFraming.zoom;
        } else {
            distance = Math.max(controls?.minDistance ?? 0.1, 8);
        }

        camera.position.copy(target.clone().addScaledVector(direction, distance));
        camera.up.copy(basis.up);

        if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
            camera.updateProjectionMatrix();
        }

        if (controls) {
            controls.target.copy(target);
            controls.update();
            return;
        }

        camera.lookAt(target);
    }, [camera, modelWorldBounds, orbitRef, scene]);

    const finishCapture = useCallback(async (pending: PendingCapture) => {
        try {
            const blob = await canvasToBlob(gl.domElement);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            triggerBrowserDownload(blob, `volt-screenshot-${timestamp}.png`);
            dismissToast();
            onStatusChange?.('Screenshot captured and downloaded.');
            sileo.success({ title: 'Screenshot captured' });
        } catch {
            dismissToast();
            onStatusChange?.('Screenshot failed. Could not capture the viewport.');
            sileo.error({ title: 'Screenshot failed', description: 'Could not capture the viewport.' });
        } finally {
            restorePointCloudMaterials(pending.pointCloudScaleSnapshot);
            restoreSnapshot(pending.snapshot);
            gl.setPixelRatio(pending.originalDpr);
            gl.setSize(pending.originalSize.width, pending.originalSize.height, false);
            setDpr(pending.originalDpr);
            setSize(pending.originalSize.width, pending.originalSize.height, false);
            pendingRef.current = null;
            useScreenshotStore.getState().setIsCapturing(false);
            invalidate();
        }
    }, [dismissToast, gl.domElement, invalidate, onStatusChange, restoreSnapshot, setDpr, setSize]);

    useEffect(() => {
        if (!captureRequest || pendingRef.current) {
            return;
        }

        const snapshot = getSnapshot();
        const originalDpr = gl.getPixelRatio();
        const originalBufferSize = {
            width: gl.domElement.width,
            height: gl.domElement.height
        };
        const outputSize = resolveScreenshotSize(captureRequest, sizeRef.current, originalDpr);
        const screenshotScale = resolveScreenshotScale(originalBufferSize, outputSize);
        const pointCloudScaleSnapshot = scalePointCloudMaterials(scene, screenshotScale);

        onCaptureHandled();
        useScreenshotStore.getState().setIsCapturing(true);

        setDpr(1);
        setSize(outputSize.width, outputSize.height, false);
        applyAnglePreset(captureRequest);

        pendingRef.current = {
            framesRemaining: 2,
            originalDpr,
            originalSize: { ...sizeRef.current },
            originalBufferSize,
            requestedSize: outputSize,
            pointCloudScaleSnapshot,
            snapshot,
            captureInFlight: false
        };

        onStatusChange?.('Capturing screenshot.');
        dismissToast();
        toastIdRef.current = sileo.show({
            type: 'loading',
            title: 'Capturing...',
            duration: null
        });
        invalidate();
    }, [
        applyAnglePreset,
        captureRequest,
        dismissToast,
        getSnapshot,
        gl,
        invalidate,
        onCaptureHandled,
        onStatusChange,
        setDpr,
        setSize
    ]);

    useFrame(() => {
        const pending = pendingRef.current;
        if (!pending || pending.captureInFlight) {
            return;
        }

        if (
            gl.domElement.width !== pending.requestedSize.width
            || gl.domElement.height !== pending.requestedSize.height
        ) {
            gl.setPixelRatio(1);
            gl.setSize(pending.requestedSize.width, pending.requestedSize.height, false);
            pending.framesRemaining = Math.max(pending.framesRemaining, 2);
            invalidate();
            return;
        }

        if (pending.framesRemaining > 0) {
            pending.framesRemaining -= 1;
            invalidate();
            return;
        }

        pending.captureInFlight = true;
        void finishCapture(pending);
    }, 2);

    useEffect(() => {
        return () => {
            dismissToast();
            useScreenshotStore.getState().setIsCapturing(false);
        };
    }, [dismissToast]);

    return null;
};

export default ScreenshotCapture;
