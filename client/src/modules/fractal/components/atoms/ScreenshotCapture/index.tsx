import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { sileo } from 'sileo';

interface ScreenshotCaptureProps {
    captureRequested: boolean;
    onCaptureHandled: () => void;
};

const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 100);
};

const ScreenshotCapture = ({ captureRequested, onCaptureHandled }: ScreenshotCaptureProps) => {
    const { gl, scene, camera } = useThree();
    const pendingRef = useRef(false);
    const frameSkipRef = useRef(0);

    const toastIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!captureRequested) return;
        onCaptureHandled();
        pendingRef.current = true;
        frameSkipRef.current = 2;
        toastIdRef.current = sileo.show({
            type: 'loading',
            title: 'Capturing...',
            duration: null
        });
    }, [captureRequested, onCaptureHandled]);

    useFrame(() => {
        if (!pendingRef.current) return;

        if (frameSkipRef.current > 0) {
            frameSkipRef.current--;
            return;
        }

        pendingRef.current = false;

        try {
            gl.render(scene, camera);
            const dataUrl = gl.domElement.toDataURL('image/png');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadDataUrl(dataUrl, `volt-screenshot-${timestamp}.png`);
            if (toastIdRef.current) sileo.dismiss(toastIdRef.current);
            sileo.success({ title: 'Screenshot captured' });
        } catch {
            if (toastIdRef.current) sileo.dismiss(toastIdRef.current);
            sileo.error({ title: 'Screenshot failed', description: 'Could not capture the viewport.' });
        }
    });

    return null;
};

export default ScreenshotCapture;
