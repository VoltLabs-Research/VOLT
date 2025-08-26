import { useRef, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

const ScreenshotHandler: React.FC<{ 
    onToolsReady: (tools: { captureScreenshot: (options?: any) => Promise<string>; waitForVisibleFrame: () => Promise<void>; markContentReady: () => void; waitForContentFrame: () => Promise<void> }) => void;
    backgroundColor: string;
}> = ({ onToolsReady, backgroundColor }) => {
    const { gl, scene, camera } = useThree();
    const hasRenderedRef = useRef(false);
    const contentReadyRef = useRef(false);

    useFrame(() => {
        hasRenderedRef.current = true;
    });

    const waitForVisibleFrame = useCallback(() => {
        return new Promise<void>((resolve) => {
            const el = gl.domElement;
            const okSize = () => el.clientWidth > 0 && el.clientHeight > 0;
            const tick = () => {
                if (okSize() && hasRenderedRef.current) {
                    requestAnimationFrame(() => requestAnimationFrame(resolve));
                } else {
                    requestAnimationFrame(tick);
                }
            };
            tick();
        });
    }, [gl]);

    const waitForContentFrame = useCallback(async () => {
        await waitForVisibleFrame();
        return new Promise<void>((resolve) => {
            const tick = () => {
                if (contentReadyRef.current && hasRenderedRef.current) {
                    requestAnimationFrame(() => requestAnimationFrame(resolve));
                } else {
                    requestAnimationFrame(tick);
                }
            };
            tick();
        });
    }, [waitForVisibleFrame]);

    const markContentReady = useCallback(() => {
        contentReadyRef.current = true;
    }, []);

    const captureScreenshot = useCallback((options?: any) => {
        const safeOptions = options || {};
        const {
            width,
            height,
            format = 'png',
            zoomFactor = 1,
            backgroundColor: customBackgroundColor = null,
            quality = 1.0
        } = safeOptions;

        return new Promise<string>((resolve, reject) => {
            try{
                const originalPosition = camera.position.clone();
                const originalZoom = camera.zoom;

                gl.render(scene, camera);

                requestAnimationFrame(() => {
                    try{
                        const canvas = gl.domElement;
                        let finalCanvas = canvas;

                        if((width && height && (width !== canvas.width || height !== canvas.height)) || format === 'jpeg'){
                            const tempCanvas = document.createElement('canvas');
                            const targetWidth = width || canvas.width;
                            const targetHeight = height || canvas.height;

                            tempCanvas.width = targetWidth;
                            tempCanvas.height = targetHeight;

                            camera.zoom = originalZoom * zoomFactor;

                            const tempCtx = tempCanvas.getContext('2d');
                            if(!tempCtx){
                                camera.position.copy(originalPosition);
                                camera.zoom = originalZoom;
                                camera.updateProjectionMatrix();
                                reject(new Error("Can't get temporal 2D canvas"));
                                return;
                            }

                            if(format === 'jpeg'){
                                tempCtx.fillStyle = customBackgroundColor || (backgroundColor);
                                tempCtx.fillRect(0, 0, targetWidth, targetHeight);
                            }

                            tempCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
                            finalCanvas = tempCanvas;
                        }

                        const mimeType = `image/${format}`;
                        const dataURL = finalCanvas.toDataURL(mimeType, quality);

                        camera.position.copy(originalPosition);
                        camera.zoom = originalZoom;
                        camera.updateProjectionMatrix();

                        gl.render(scene, camera);

                        if(dataURL === 'data:,' || dataURL.length < 100){
                            reject(new Error('The canvas is empty or could not be captured'));
                            return;
                        }

                        resolve(dataURL);
                    }catch(innerError){
                        camera.position.copy(originalPosition);
                        camera.zoom = originalZoom;
                        camera.updateProjectionMatrix();
                        gl.render(scene, camera);
                        reject(innerError);
                    }
                });
            }catch(error){
                reject(error);
            }
        });
    }, [gl, scene, camera, backgroundColor]);

    useEffect(() => {
        onToolsReady({ captureScreenshot, waitForVisibleFrame, markContentReady, waitForContentFrame });
    }, [captureScreenshot, waitForVisibleFrame, waitForContentFrame, markContentReady, onToolsReady]);

    return null;
};

export default ScreenshotHandler;