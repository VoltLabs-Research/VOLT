import React, { useMemo, useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import FractalScenePipeline from '@/modules/fractal/presentation/components/organisms/FractalScenePipeline';
import type { FractalSceneConfig } from '@/modules/fractal/presentation/types/scene-config';

export interface FractalSceneRef {
    zoomTo: (zoomPercent: number) => void;
    getCurrentZoom: () => number;
}

interface FractalSceneProps {
    config: FractalSceneConfig;
    children?: React.ReactNode;
    showGizmo?: boolean;
    onControlsRef?: (ref: any) => void;
    onInteractionChange?: (isInteracting: boolean) => void;
    showGrid?: boolean;
}

const FractalScene = forwardRef<FractalSceneRef, FractalSceneProps>(({
    config,
    children,
    showGizmo = true,
    onControlsRef,
    onInteractionChange,
    showGrid
}, ref) => {
    const orbitControlsRef = useRef<any>(null);
    const initialDistanceRef = useRef<number | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const dpr = useMemo(() => {
        if (config.dpr.mode === 'fixed') return config.dpr.fixed;
        const min = (isInteracting && config.interactionDegradeEnabled)
            ? Math.min(config.dpr.interactionMin, config.dpr.min)
            : config.dpr.min;
        return [min, config.dpr.max] as [number, number];
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

            if (!initialDistanceRef.current) {
                initialDistanceRef.current = camera.position.distanceTo(controls.target);
            }

            const targetDistance = initialDistanceRef.current * (100 / zoomPercent);
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
            if (!initialDistanceRef.current) {
                initialDistanceRef.current = camera.position.distanceTo(controls.target);
            }
            const currentDistance = camera.position.distanceTo(controls.target);
            const zoomPercent = (initialDistanceRef.current * 100) / currentDistance;
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

    const orbitProps = useMemo(() => {
        const { target, set, setTarget, reset, ...rest } = config.orbitControls as any;
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
