import FractalScenePipeline from '@/modules/fractal/components/organisms/FractalScenePipeline';
import VisuallyHidden from '@/shared/presentation/primitives/VisuallyHidden';
import { resolveCanvasRuntimeProps } from '@/shared/domain/rendering/performance';
import { debugFractal, warnFractal } from '@/modules/fractal/utilities/debug-log';
import './FractalScene.css';
import { Canvas } from '@react-three/fiber';
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { ScreenshotRequest } from '@/modules/canvas/utilities/screenshot';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { ScreenshotComposition } from '@/modules/fractal/types/screenshot-composition';
import type { ReactNode } from 'react';

export interface FractalSceneRef {
    zoomTo: (zoomPercent: number) => void;
    getCurrentZoom: () => number;
    resetCamera: () => void;
    subscribeZoom: (listener: (zoom: number) => void) => () => void;
};

type OrbitControlsSceneProps = Omit<FractalSceneConfig['orbitControls'], 'target'>;

interface FractalSceneProps {
    config: FractalSceneConfig;
    children?: ReactNode;
    showGizmo?: boolean;
    onControlsRef?: (ref: OrbitControlsHandle | null) => void;
    onInteractionChange?: (isInteracting: boolean) => void;
    showGrid?: boolean;
    modelWorldBounds?: ModelWorldBounds | null;
    screenshotRequest?: ScreenshotRequest | null;
    screenshotComposition?: ScreenshotComposition;
    onScreenshotCaptureHandled?: () => void;
};

const FractalScene = forwardRef<FractalSceneRef, FractalSceneProps>(({
    config,
    children,
    showGizmo = true,
    onControlsRef,
    onInteractionChange,
    showGrid,
    modelWorldBounds,
    screenshotRequest,
    screenshotComposition,
    onScreenshotCaptureHandled
}, ref) => {
    const orbitControlsRef = useRef<OrbitControlsHandle | null>(null);
    const initialDistanceRef = useRef<number | null>(null);
    const initialCameraStateRef = useRef<{ position: [number, number, number]; target: [number, number, number] } | null>(null);
    const canvasEventCleanupRef = useRef<(() => void) | null>(null);
    const zoomListenersRef = useRef<Set<(zoom: number) => void>>(new Set());
    const zoomRafRef = useRef<number | null>(null);
    const lastEmittedZoomRef = useRef<number>(100);
    // isInteracting is stored in a ref to avoid re-rendering the entire Canvas
    // subtree on every orbit start/end. R3F's performance.regress() + AdaptiveDpr
    // handle DPR degradation natively without React state.
    const isInteractingRef = useRef(false);
    const [screenshotAnnouncement, setScreenshotAnnouncement] = useState('');
    const titleId = useId();
    const descriptionId = useId();

    // Compute DPR/performance once (non-interacting baseline).
    // During interaction, R3F's built-in adaptive system handles degradation.
    const canvasRuntimeProps = useMemo(() => {
        return resolveCanvasRuntimeProps({
            dpr: config.dpr,
            performance: config.performance,
            interactionDegradeEnabled: config.interactionDegradeEnabled
        }, {
            interacting: false
        });
    }, [
        config.dpr,
        config.interactionDegradeEnabled,
        config.performance
    ]);

    useEffect(() => {
        if (!orbitControlsRef.current) return;
        const target = config.orbitControls.target;
        orbitControlsRef.current.target.set(target[0], target[1], target[2]);
        orbitControlsRef.current.update();
    }, [config.orbitControls.target]);

    useEffect(() => {
        return () => {
            canvasEventCleanupRef.current?.();
            canvasEventCleanupRef.current = null;
        };
    }, []);

    const markInteracting = useCallback((active: boolean) => {
        isInteractingRef.current = active;
        onInteractionChange?.(active);
    }, [onInteractionChange]);

    const computeZoomPercent = useCallback((): number => {
        if (!orbitControlsRef.current) return lastEmittedZoomRef.current;
        const controls = orbitControlsRef.current;
        const camera = controls.object;
        if (initialDistanceRef.current === null) {
            initialDistanceRef.current = camera.position.distanceTo(controls.target);
        }

        const initialDistance = initialDistanceRef.current;
        if (!initialDistance) return 100;

        const currentDistance = camera.position.distanceTo(controls.target);
        const rawPercent = (initialDistance * 100) / currentDistance;
        const rounded = Math.round(rawPercent / 5) * 5;
        return Math.max(10, Math.min(1000, rounded));
    }, []);

    const notifyZoomListeners = useCallback(() => {
        if (zoomRafRef.current !== null) return;
        zoomRafRef.current = window.requestAnimationFrame(() => {
            zoomRafRef.current = null;
            const zoom = computeZoomPercent();
            if (zoom === lastEmittedZoomRef.current) return;
            lastEmittedZoomRef.current = zoom;
            zoomListenersRef.current.forEach((listener) => listener(zoom));
        });
    }, [computeZoomPercent]);

    const boundChangeHandlerRef = useRef<(() => void) | null>(null);

    const handleControlsRef = useCallback((controls: OrbitControlsHandle | null) => {
        if (boundChangeHandlerRef.current && orbitControlsRef.current) {
            orbitControlsRef.current.removeEventListener('change', boundChangeHandlerRef.current);
            boundChangeHandlerRef.current = null;
        }

        orbitControlsRef.current = controls;

        if (controls) {
            const camera = controls.object;
            if (initialCameraStateRef.current === null) {
                initialCameraStateRef.current = {
                    position: [camera.position.x, camera.position.y, camera.position.z],
                    target: [controls.target.x, controls.target.y, controls.target.z]
                };
                initialDistanceRef.current = camera.position.distanceTo(controls.target);
            }

            const handler = () => notifyZoomListeners();
            controls.addEventListener('change', handler);
            boundChangeHandlerRef.current = handler;
        }

        onControlsRef?.(controls);
    }, [notifyZoomListeners, onControlsRef]);

    useEffect(() => {
        return () => {
            if (boundChangeHandlerRef.current && orbitControlsRef.current) {
                orbitControlsRef.current.removeEventListener('change', boundChangeHandlerRef.current);
                boundChangeHandlerRef.current = null;
            }
            if (zoomRafRef.current !== null) {
                window.cancelAnimationFrame(zoomRafRef.current);
                zoomRafRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const handleCameraCommand = (event: Event) => {
            const detail = (event as CustomEvent<{ command?: string }>).detail;
            if (detail?.command !== 'reset-camera') return;

            const controls = orbitControlsRef.current;
            const initial = initialCameraStateRef.current;
            if (!controls || !initial) return;

            const camera = controls.object;
            camera.position.set(initial.position[0], initial.position[1], initial.position[2]);
            controls.target.set(initial.target[0], initial.target[1], initial.target[2]);
            controls.update();
            initialDistanceRef.current = camera.position.distanceTo(controls.target);
            notifyZoomListeners();
        };

        const handleCameraInitialUpdate = (event: Event) => {
            const detail = (event as CustomEvent<{
                position: [number, number, number];
                target: [number, number, number];
            }>).detail;
            if (!detail) return;

            initialCameraStateRef.current = {
                position: detail.position,
                target: detail.target
            };
            const controls = orbitControlsRef.current;
            if (controls) {
                initialDistanceRef.current = controls.object.position.distanceTo(controls.target);
            }
        };

        window.addEventListener('Volt:camera-command', handleCameraCommand);
        window.addEventListener('Volt:camera-initial-update', handleCameraInitialUpdate);
        return () => {
            window.removeEventListener('Volt:camera-command', handleCameraCommand);
            window.removeEventListener('Volt:camera-initial-update', handleCameraInitialUpdate);
        };
    }, [notifyZoomListeners]);

    useImperativeHandle(ref, () => ({
        zoomTo: (zoomPercent: number) => {
            if (!orbitControlsRef.current) return;
            const controls = orbitControlsRef.current;
            const camera = controls.object;

            if (initialDistanceRef.current === null) {
                initialDistanceRef.current = camera.position.distanceTo(controls.target);
            }

            const initialDistance = initialDistanceRef.current;
            if (initialDistance === null) {
                return;
            }

            const targetDistance = initialDistance * (100 / zoomPercent);
            const currentPosition = camera.position.clone();
            const direction = currentPosition.clone().sub(controls.target).normalize();

            const clampedDistance = Math.max(
                controls.minDistance,
                Math.min(controls.maxDistance, targetDistance)
            );
            const clampedPosition = controls.target.clone().addScaledVector(direction, clampedDistance);
            camera.position.copy(clampedPosition);
            controls.update();
            notifyZoomListeners();
        },
        getCurrentZoom: () => computeZoomPercent(),
        resetCamera: () => {
            window.dispatchEvent(new CustomEvent('Volt:camera-command', {
                detail: { command: 'reset-camera' }
            }));
        },
        subscribeZoom: (listener) => {
            zoomListenersRef.current.add(listener);
            listener(computeZoomPercent());
            return () => {
                zoomListenersRef.current.delete(listener);
            };
        }
    }), [computeZoomPercent, notifyZoomListeners]);

    const glProps = useMemo(() => ({
        antialias: config.rendererCreate.antialias,
        alpha: config.rendererCreate.alpha,
        depth: config.rendererCreate.depth,
        stencil: config.rendererCreate.stencil,
        logarithmicDepthBuffer: config.rendererCreate.logarithmicDepthBuffer,
        preserveDrawingBuffer: config.rendererCreate.preserveDrawingBuffer,
        premultipliedAlpha: config.rendererCreate.premultipliedAlpha,
        failIfMajorPerformanceCaveat: config.rendererCreate.failIfMajorPerformanceCaveat,
        precision: config.rendererCreate.precision,
        powerPreference: config.rendererCreate.powerPreference
    }), [config.rendererCreate]);

    const orbitProps = useMemo<OrbitControlsSceneProps>(() => {
        const { target, ...rest } = config.orbitControls;
        return rest;
    }, [config.orbitControls]);

    return (
        <section className='fractal-scene' role='region' aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={0}>
            <VisuallyHidden as='h2' id={titleId}>3D model viewer</VisuallyHidden>
            <VisuallyHidden as='p' id={descriptionId}>
                Interactive 3D viewport. Use mouse controls to orbit, pan, and zoom. When a model is selected, extra rotation controls appear in the viewer.
            </VisuallyHidden>
            <VisuallyHidden as='div' aria-live='polite' aria-atomic='true'>
                {screenshotAnnouncement}
            </VisuallyHidden>
            <Canvas
                gl={glProps}
                dpr={canvasRuntimeProps.dpr}
                frameloop='demand'
                performance={canvasRuntimeProps.performance}
                className='fractal-scene__canvas'
                onCreated={(state) => {
                    canvasEventCleanupRef.current?.();

                    const canvas = state.gl.domElement;
                    const handleContextLost = (event: Event) => {
                        event.preventDefault();
                        warnFractal('fractal-scene.context-lost', {
                            canvasWidth: canvas.width,
                            canvasHeight: canvas.height
                        });
                    };
                    const handleContextRestored = () => {
                        debugFractal('fractal-scene.context-restored', {
                            canvasWidth: canvas.width,
                            canvasHeight: canvas.height
                        });
                        state.invalidate();
                    };

                    canvas.addEventListener('webglcontextlost', handleContextLost);
                    canvas.addEventListener('webglcontextrestored', handleContextRestored);
                    canvasEventCleanupRef.current = () => {
                        canvas.removeEventListener('webglcontextlost', handleContextLost);
                        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
                    };
                    state.invalidate();
                }}
            >
                <FractalScenePipeline
                    config={config}
                    orbitRef={orbitControlsRef}
                    orbitProps={orbitProps}
                    showGizmo={showGizmo}
                    showGrid={showGrid}
                    modelWorldBounds={modelWorldBounds}
                    screenshotRequest={screenshotRequest}
                    screenshotComposition={screenshotComposition}
                    onScreenshotCaptureHandled={onScreenshotCaptureHandled}
                    onScreenshotStatusChange={setScreenshotAnnouncement}
                    onControlsRef={handleControlsRef}
                    markInteracting={markInteracting}
                >
                    {children}
                </FractalScenePipeline>
            </Canvas>
        </section>
    );
});

export default FractalScene;
