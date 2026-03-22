import FractalScenePipeline from '@/modules/fractal/components/organisms/FractalScenePipeline';
import { resolveCanvasRuntimeProps } from '@/shared/domain/rendering/performance';
import './FractalScene.css';
import { Canvas } from '@react-three/fiber';
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { ScreenshotRequest } from '@/modules/canvas/utilities/screenshot';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { ReactNode } from 'react';

export interface FractalSceneRef {
    zoomTo: (zoomPercent: number) => void;
    getCurrentZoom: () => number;
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
    onScreenshotCaptureHandled
}, ref) => {
    const orbitControlsRef = useRef<OrbitControlsHandle | null>(null);
    const initialDistanceRef = useRef<number | null>(null);
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

    const markInteracting = useCallback((active: boolean) => {
        isInteractingRef.current = active;
        onInteractionChange?.(active);
    }, [onInteractionChange]);

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
        },
        getCurrentZoom: () => {
            if (!orbitControlsRef.current) return 100;
            const controls = orbitControlsRef.current;
            const camera = controls.object;
            if (initialDistanceRef.current === null) {
                initialDistanceRef.current = camera.position.distanceTo(controls.target);
            }

            const initialDistance = initialDistanceRef.current;
            if (initialDistance === null) {
                return 100;
            }

            const currentDistance = camera.position.distanceTo(controls.target);
            const zoomPercent = (initialDistance * 100) / currentDistance;
            const rounded = Math.round(zoomPercent / 5) * 5;
            return Math.max(10, Math.min(1000, rounded));
        }
    }), []);

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
            <h2 id={titleId} className='fractal-scene__visually-hidden'>3D model viewer</h2>
            <p id={descriptionId} className='fractal-scene__visually-hidden'>
                Interactive 3D viewport. Use mouse controls to orbit, pan, and zoom. When a model is selected, extra rotation controls appear in the viewer.
            </p>
            <div className='fractal-scene__visually-hidden' aria-live='polite' aria-atomic='true'>
                {screenshotAnnouncement}
            </div>
            <Canvas
                gl={glProps}
                dpr={canvasRuntimeProps.dpr}
                frameloop='demand'
                performance={canvasRuntimeProps.performance}
                className='fractal-scene__canvas'
                onCreated={(state) => {
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
                    onScreenshotCaptureHandled={onScreenshotCaptureHandled}
                    onScreenshotStatusChange={setScreenshotAnnouncement}
                    onControlsRef={onControlsRef}
                    markInteracting={markInteracting}
                >
                    {children}
                </FractalScenePipeline>
            </Canvas>
        </section>
    );
});

export default FractalScene;
