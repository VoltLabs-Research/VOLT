import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import { resolveScreenshotScale, resolveScreenshotSize } from '@/modules/canvas/utils/screenshot';
import { applyCameraAnglePreset, getCaptureBounds } from '@/modules/fractal/utils/camera-framing';
import { encodeCanvasToPngBlob } from '@/modules/fractal/components/atoms/ScreenshotCapture/capture-canvas';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { sileo } from 'sileo';
import { PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3 } from 'three';

import type { ScreenshotRequest } from '@/modules/canvas/utils/screenshot';
import type { ModelWorldBounds } from '@/modules/fractal/contracts/model';
import type { OrbitControlsHandle } from '@/modules/fractal/contracts';
import type { ScreenshotComposition } from '@/modules/fractal/contracts/screenshot-composition';
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

type PointScaleSnapshot = Array<{ material: ShaderMaterial; pointScale: number }>;

interface PendingCapture {
    framesRemaining: number;
    originalDpr: number;
    originalSize: { width: number; height: number };
    requestedSize: { width: number; height: number };
    pointCloudScaleSnapshot: PointScaleSnapshot;
    snapshot: ScreenshotViewSnapshot;
    screenshotComposition?: ScreenshotComposition;
    captureInFlight: boolean;
}

const scalePointCloudMaterials = (scene: Scene, scale: number): PointScaleSnapshot => {
    const snapshot: PointScaleSnapshot = [];

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

        snapshot.push({
            material,
            pointScale
        });
        material.uniforms.pointScale.value = pointScale * scale;
    });

    return snapshot;
};

const restorePointCloudMaterials = (snapshot: PointScaleSnapshot) => {
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
    const sizeRef = useRef(size);
    sizeRef.current = size;

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
            zoom: camera.zoom,
            aspect: camera instanceof PerspectiveCamera ? camera.aspect : undefined
        };
    }, [camera, orbitRef]);

    const restoreSnapshot = useCallback((snapshot: ScreenshotViewSnapshot) => {
        const controls = orbitRef?.current;
        camera.position.copy(snapshot.position);
        camera.up.copy(snapshot.up);
        camera.zoom = snapshot.zoom;

        if (camera instanceof PerspectiveCamera && snapshot.aspect !== undefined) {
            camera.aspect = snapshot.aspect;
        }

        camera.updateProjectionMatrix();

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
            const blob = await encodeCanvasToPngBlob(
                gl.domElement,
                camera,
                pending.screenshotComposition?.cropBoundsWorld
            );
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            triggerBrowserDownload(blob, `volt-screenshot-${timestamp}.png`);
            dismissToast();
            onStatusChange?.('Screenshot captured and downloaded.');
            sileo.success({ title: 'Screenshot captured' });
        } catch {
            dismissToast();
            onStatusChange?.('Screenshot failed. Could not capture the viewport.');
            sileo.error({
                title: 'Screenshot failed',
                description: 'Could not capture the viewport.'
            });
        } finally {
            restorePointCloudMaterials(pending.pointCloudScaleSnapshot);
            restoreSnapshot(pending.snapshot);
            gl.setPixelRatio(pending.originalDpr);
            gl.setSize(pending.originalSize.width, pending.originalSize.height, false);
            setDpr(pending.originalDpr);
            setSize(pending.originalSize.width, pending.originalSize.height);
            pendingRef.current = null;
            useScreenshotStore.getState().setIsCapturing(false);
            invalidate();
        }
    }, [camera, dismissToast, gl, invalidate, onStatusChange, restoreSnapshot, setDpr, setSize]);

    useEffect(() => {
        if (!captureRequest || pendingRef.current) {
            return;
        }

        const snapshot = getSnapshot();
        const originalDpr = gl.getPixelRatio();
        const outputSize = resolveScreenshotSize(captureRequest, sizeRef.current, originalDpr);
        const screenshotScale = resolveScreenshotScale(
            {
                width: gl.domElement.width,
                height: gl.domElement.height
            },
            outputSize
        );
        const pointCloudScaleSnapshot = scalePointCloudMaterials(scene, screenshotScale);

        onCaptureHandled();
        useScreenshotStore.getState().setIsCapturing(true);

        setDpr(1);
        setSize(outputSize.width, outputSize.height);
        if (camera instanceof PerspectiveCamera) {
            camera.aspect = outputSize.width / outputSize.height;
            camera.updateProjectionMatrix();
        }
        applyAnglePreset(captureRequest);

        pendingRef.current = {
            framesRemaining: 2,
            originalDpr,
            originalSize: {
                width: sizeRef.current.width,
                height: sizeRef.current.height
            },
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
        camera,
        captureRequest,
        dismissToast,
        getSnapshot,
        gl,
        invalidate,
        onCaptureHandled,
        onStatusChange,
        scene,
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
