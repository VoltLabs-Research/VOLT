import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScreenshotStore } from '@/modules/canvas/presentation/stores/use-screenshot-store';
import type { ScreenshotSettings } from '@/modules/canvas/presentation/stores/use-screenshot-store';
import { sileo } from 'sileo';

const resolveOutputSize = (
    settings: ScreenshotSettings,
    viewportWidth: number,
    viewportHeight: number,
    supersamplingFactor: number
): { width: number; height: number } => {
    let w: number;
    let h: number;

    if (settings.resolutionPreset === 'Viewport' || (settings.width <= 0 && settings.height <= 0)) {
        w = viewportWidth;
        h = viewportHeight;
    } else if (settings.resolutionPreset === 'Custom') {
        w = settings.width > 0 ? settings.width : viewportWidth;
        h = settings.height > 0 ? settings.height : viewportHeight;
    } else {
        w = settings.width;
        h = settings.height;
    }

    return {
        width: Math.round(w * supersamplingFactor),
        height: Math.round(h * supersamplingFactor)
    };
};

const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
};

const ScreenshotCapture = () => {
    const { gl, scene, camera, size } = useThree();
    const captureRequested = useScreenshotStore((s) => s.captureRequested);
    const previewRequested = useScreenshotStore((s) => s.previewRequested);
    const pendingRef = useRef<'capture' | 'preview' | null>(null);
    const frameSkipRef = useRef(0);

    useEffect(() => {
        useScreenshotStore.getState().setViewportSize({ width: size.width, height: size.height });
    }, [size.width, size.height]);

    useEffect(() => {
        if (captureRequested) {
            const store = useScreenshotStore.getState();
            store.clearCaptureRequest();
            store.clearPreviewRequest();
            store.setIsCapturing(true);
            pendingRef.current = 'capture';
            frameSkipRef.current = 2;
        } else if (previewRequested) {
            const store = useScreenshotStore.getState();
            store.clearPreviewRequest();
            store.setIsCapturing(true);
            pendingRef.current = 'preview';
            frameSkipRef.current = 2;
        }
    }, [captureRequested, previewRequested]);

    useFrame(() => {
        if (!pendingRef.current) return;

        if (frameSkipRef.current > 0) {
            frameSkipRef.current--;
            return;
        }

        const mode = pendingRef.current;
        pendingRef.current = null;
        const store = useScreenshotStore.getState();

        try {
            const { settings } = store;
            const factor = settings.supersamplingFactor;
            const output = resolveOutputSize(settings, size.width, size.height, factor);

            const originalSize = { width: gl.domElement.width, height: gl.domElement.height };
            const originalPixelRatio = gl.getPixelRatio();
            const originalBackground = scene.background;
            const originalAutoClear = gl.autoClear;

            gl.setPixelRatio(1);
            gl.setSize(output.width, output.height, false);
            gl.autoClear = true;

            if (settings.background === 'transparent') {
                scene.background = null;
                gl.setClearColor(0x000000, 0);
            } else if (settings.background === 'custom') {
                scene.background = new THREE.Color(settings.customBackgroundColor);
            }

            gl.clear();
            gl.render(scene, camera);

            const mimeType = settings.format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const quality = settings.format === 'jpeg' ? settings.jpegQuality : undefined;
            const dataUrl = gl.domElement.toDataURL(mimeType, quality);

            scene.background = originalBackground;
            gl.autoClear = originalAutoClear;
            gl.setPixelRatio(originalPixelRatio);
            gl.setSize(originalSize.width / originalPixelRatio, originalSize.height / originalPixelRatio, false);

            gl.clear();
            gl.render(scene, camera);

            store.setPreview(dataUrl);

            if (mode === 'capture') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const ext = settings.format === 'jpeg' ? 'jpg' : 'png';
                const filename = `volt-screenshot-${timestamp}.${ext}`;
                downloadDataUrl(dataUrl, filename);
                sileo.success({ title: 'Screenshot captured' });
            }
        } catch {
            sileo.error({ title: 'Screenshot failed', description: 'Could not capture the viewport.' });
        } finally {
            store.setIsCapturing(false);
        }
    });

    return null;
};

export default ScreenshotCapture;
