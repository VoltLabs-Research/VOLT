import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import { resolveScreenshotScale, resolveScreenshotSize } from '@/modules/canvas/utilities/screenshot';
import {
    applyCameraAnglePreset,
    getBoxCorners,
    getCaptureBounds,
    getFallbackBoxFromModelWorldBounds
} from '@/modules/fractal/utilities/camera-framing';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { sileo } from 'sileo';
import {
    OrthographicCamera,
    PerspectiveCamera,
    Points,
    Scene,
    ShaderMaterial,
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
}

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

interface PixelCropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

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
        const controls = orbitRef?.current;
        const captureBounds = getCaptureBounds(
            scene,
            modelWorldBounds,
            screenshotComposition?.framingBoundsWorld
        );
        const target = captureBounds?.center.clone() ?? controls?.target.clone() ?? new Vector3(0, 0, 0);
        applyCameraAnglePreset({
            anglePreset: request.anglePreset,
            camera,
            sceneUp: scene.up,
            target,
            captureBounds,
            controls
        });
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
