import { Canvas } from '@react-three/fiber';
import FractalScenePipeline from '@/modules/fractal/components/organisms/FractalScenePipeline';
import { useMemo, useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
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
    screenshotCaptureRequested?: boolean;
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
    screenshotCaptureRequested,
    onScreenshotCaptureHandled
}, ref) => {
    const orbitControlsRef = useRef<OrbitControlsHandle | null>(null);
    const initialDistanceRef = useRef<number | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const dpr = useMemo<number | [number, number]>(() => {
        if (config.dpr.mode === 'fixed') return config.dpr.fixed;
        let min = config.dpr.min;
        if (isInteracting && config.interactionDegradeEnabled) {
            min = Math.min(config.dpr.interactionMin, config.dpr.min);
        }
        const range: [number, number] = [min, config.dpr.max];
        return range;
    }, [config.dpr, config.interactionDegradeEnabled, isInteracting]);

    useEffect(() => {
        if (!orbitControlsRef.current) return;
        const target = config.orbitControls.target;
        orbitControlsRef.current.target.set(target[0], target[1], target[2]);
        orbitControlsRef.current.update();
    }, [config.orbitControls.target]);

    const markInteracting = useCallback((active: boolean) => {
        setIsInteracting(active);
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
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas
                gl={glProps}
                dpr={dpr}
                frameloop='demand'
                performance={config.performance}
                style={{ width: '100%', height: '100%' }}
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
                screenshotCaptureRequested={screenshotCaptureRequested}
                onScreenshotCaptureHandled={onScreenshotCaptureHandled}
                onControlsRef={onControlsRef}
                markInteracting={markInteracting}
            >
                {children}
            </FractalScenePipeline>
            </Canvas>
        </div>
    );
});

export default FractalScene;
