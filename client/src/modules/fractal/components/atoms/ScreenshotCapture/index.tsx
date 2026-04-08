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
import type { ScreenshotComposition } from '@/modules/fractal/types/screenshot-composition';
import type { MutableRefObject } from 'react';

interface ScreenshotCaptureProps {
    captureRequest?: ScreenshotRequest | null;
    onCaptureHandled: () => void;
    onStatusChange?: (message: string) => void;
    orbitRef?: MutableRefObject<OrbitControlsHandle | null>;
    modelWorldBounds?: ModelWorldBounds | null;
    screenshotComposition?: ScreenshotComposition;
};

interface ScreenshotViewSnapshot {
    position: Vector3;
    target: Vector3;
    up: Vector3;
    zoom: number;
    aspect?: number;
}

interface PendingCapture {
    framesRemaining: number;
    originalDpr: number;
    originalSize: { width: number; height: number };
    originalBufferSize: { width: number; height: number };
    requestedSize: { width: number; height: number };
    pointCloudScaleSnapshot: Array<{ material: ShaderMaterial; pointScale: number }>;
    snapshot: ScreenshotViewSnapshot;
    screenshotComposition?: ScreenshotComposition;
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

interface PixelCropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const SCREENSHOT_CAPTURE_TARGET_KEY = 'isScreenshotCaptureTarget';
const SCREENSHOT_CAPTURE_PADDING = 1.15;
const SCREENSHOT_CROP_MIN_DIMENSION = 4;
const SCREENSHOT_CROP_PIXEL_PADDING = 2;

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
        case 'ground-isometric':
            return new Vector3(1, -1, 0).normalize();
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

const getPixelCropRectFromWorldBounds = (
    worldBounds: ModelWorldBounds,
    camera: PerspectiveCamera | OrthographicCamera,
    canvasWidth: number,
    canvasHeight: number
): PixelCropRect | null => {
    const box = getFallbackBoxFromModelWorldBounds(worldBounds);
    if (!box || box.isEmpty() || canvasWidth <= 0 || canvasHeight <= 0) {
        return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let hasProjectedPoint = false;

    getBoxCorners(box).forEach((corner) => {
        const projected = corner.clone().project(camera);

        if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
            return;
        }

        const x = ((projected.x + 1) * 0.5) * canvasWidth;
        const y = ((1 - projected.y) * 0.5) * canvasHeight;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasProjectedPoint = true;
    });

    if (!hasProjectedPoint) {
        return null;
    }

    const left = Math.max(0, Math.floor(minX) - SCREENSHOT_CROP_PIXEL_PADDING);
    const top = Math.max(0, Math.floor(minY) - SCREENSHOT_CROP_PIXEL_PADDING);
    const right = Math.min(canvasWidth, Math.ceil(maxX) + SCREENSHOT_CROP_PIXEL_PADDING);
    const bottom = Math.min(canvasHeight, Math.ceil(maxY) + SCREENSHOT_CROP_PIXEL_PADDING);
    const width = right - left;
    const height = bottom - top;

    if (width < SCREENSHOT_CROP_MIN_DIMENSION || height < SCREENSHOT_CROP_MIN_DIMENSION) {
        return null;
    }

    return {
        x: left,
        y: top,
        width,
        height
    };
};

const cropCanvasToRect = (sourceCanvas: HTMLCanvasElement, cropRect: PixelCropRect) => {
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropRect.width;
    outputCanvas.height = cropRect.height;

    const context = outputCanvas.getContext('2d');
    if (!context) {
        throw new Error('Could not create a 2D context for screenshot cropping.');
    }

    context.drawImage(
        sourceCanvas,
        cropRect.x,
        cropRect.y,
        cropRect.width,
        cropRect.height,
        0,
        0,
        cropRect.width,
        cropRect.height
    );

    return outputCanvas;
};

const getCaptureBounds = (
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
    modelWorldBounds,
    screenshotComposition
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
            zoom: 'zoom' in camera && typeof camera.zoom === 'number' ? camera.zoom : 1,
            aspect: camera instanceof PerspectiveCamera ? camera.aspect : undefined
        };
    }, [camera, orbitRef]);

    const restoreSnapshot = useCallback((snapshot: ScreenshotViewSnapshot) => {
        const controls = orbitRef?.current;
        camera.position.copy(snapshot.position);
        camera.up.copy(snapshot.up);

        if ('zoom' in camera && typeof camera.zoom === 'number') {
            camera.zoom = snapshot.zoom;
        }
        if (camera instanceof PerspectiveCamera && typeof snapshot.aspect === 'number') {
            camera.aspect = snapshot.aspect;
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
        const captureBounds = getCaptureBounds(
            scene,
            modelWorldBounds,
            screenshotComposition?.framingBoundsWorld
        );
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
    }, [camera, modelWorldBounds, orbitRef, scene, screenshotComposition?.framingBoundsWorld]);

    const finishCapture = useCallback(async (pending: PendingCapture) => {
        try {
            const cropBoundsWorld = pending.screenshotComposition?.cropBoundsWorld;
            const croppedCanvas = cropBoundsWorld && (
                camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera
            )
                ? cropCanvasToRect(
                    gl.domElement,
                    getPixelCropRectFromWorldBounds(
                        cropBoundsWorld,
                        camera,
                        gl.domElement.width,
                        gl.domElement.height
                    ) ?? {
                        x: 0,
                        y: 0,
                        width: gl.domElement.width,
                        height: gl.domElement.height
                    }
                )
                : gl.domElement;
            const blob = await canvasToBlob(croppedCanvas);
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
        if (camera instanceof PerspectiveCamera) {
            camera.aspect = outputSize.width / outputSize.height;
            camera.updateProjectionMatrix();
        }
        applyAnglePreset(captureRequest);

        pendingRef.current = {
            framesRemaining: 2,
            originalDpr,
            originalSize: { ...sizeRef.current },
            originalBufferSize,
            requestedSize: outputSize,
            pointCloudScaleSnapshot,
            snapshot,
            screenshotComposition,
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
        screenshotComposition,
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

        if (camera instanceof PerspectiveCamera) {
            const requestedAspect = pending.requestedSize.width / pending.requestedSize.height;
            if (Math.abs(camera.aspect - requestedAspect) > 1e-6) {
                camera.aspect = requestedAspect;
                camera.updateProjectionMatrix();
                pending.framesRemaining = Math.max(pending.framesRemaining, 2);
                invalidate();
                return;
            }
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
