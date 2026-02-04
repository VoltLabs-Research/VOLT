import React, { useMemo, useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, AdaptiveDpr, AdaptiveEvents, Preload, Bvh } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import DynamicRenderer from '@/modules/fractal/presentation/components/molecules/DynamicRenderer';
import DynamicBackground from '@/modules/fractal/presentation/components/molecules/DynamicBackground';
import DynamicEnvironment from '@/modules/fractal/presentation/components/molecules/DynamicEnvironment';
import DynamicLights from '@/modules/fractal/presentation/components/molecules/DynamicLights';
import DynamicEffects from '@/modules/fractal/presentation/components/molecules/DynamicEffects';
import CameraRig from '@/modules/fractal/presentation/components/atoms/CameraRig';
import CanvasGrid from '@/modules/fractal/presentation/components/atoms/CanvasGrid';
import SlicePlaneHelper from '@/modules/fractal/presentation/components/atoms/SlicePlaneHelper';
import PerformanceStatsCollector from '@/modules/fractal/presentation/components/atoms/PerformanceStatsCollector';
import type { FractalSceneConfig } from '@/modules/fractal/presentation/types/scene-config';
import type { RendererStats } from '@/modules/fractal/presentation/stores/editor/visual-settings-slice';

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
    onStats?: (stats: RendererStats) => void;
    showPerformanceStats?: boolean;
    showGrid?: boolean;
}

const FractalScene = forwardRef<FractalSceneRef, FractalSceneProps>(({
    config,
    children,
    showGizmo = true,
    onControlsRef,
    onInteractionChange,
    onStats,
    showPerformanceStats = false,
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

    const handleControlsRef = useCallback((r: any) => {
        orbitControlsRef.current = r;
        onControlsRef?.(r);
    }, [onControlsRef]);

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

    const isDefectScene = config.activeScene?.sceneType === 'defect';
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
            <DynamicRenderer settings={config.rendererRuntime} />
            <CameraRig orbitRef={orbitControlsRef} camera={config.camera} />
            {onStats && showPerformanceStats && (
                <PerformanceStatsCollector enabled onStats={onStats} />
            )}
            <Preload all />
            {config.dpr.mode === 'adaptive' && <AdaptiveDpr pixelated={config.dpr.pixelated} />}
            {config.adaptiveEventsEnabled && <AdaptiveEvents />}

            {showGizmo && (
                <GizmoHelper alignment='top-left' renderPriority={2} margin={[450, 70]}>
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <ambientLight intensity={0.7} />
                    <GizmoViewport scale={30} hideNegativeAxes axisColors={['#2c2c2e', '#2c2c2e', '#2c2c2e']} labelColor='#8e8e93' />
                </GizmoHelper>
            )}

            <DynamicBackground settings={config.environment} />
            <DynamicEffects settings={config.effects} />
            <DynamicLights settings={config.lights} />
            <DynamicEnvironment settings={config.environment} />

            <DynamicLights preset={isDefectScene ? 'defect' : 'trajectory'} />

            <OrbitControls
                ref={handleControlsRef}
                enabled={config.orbitControls.enabled}
                enableDamping={config.orbitControls.enableDamping}
                dampingFactor={config.orbitControls.dampingFactor}
                enableZoom={config.orbitControls.enableZoom}
                zoomSpeed={config.orbitControls.zoomSpeed}
                enableRotate={config.orbitControls.enableRotate}
                rotateSpeed={config.orbitControls.rotateSpeed}
                enablePan={config.orbitControls.enablePan}
                panSpeed={config.orbitControls.panSpeed}
                screenSpacePanning={config.orbitControls.screenSpacePanning}
                autoRotate={config.orbitControls.autoRotate}
                autoRotateSpeed={config.orbitControls.autoRotateSpeed}
                minDistance={config.orbitControls.minDistance}
                maxDistance={config.orbitControls.maxDistance}
                minPolarAngle={config.orbitControls.minPolarAngle}
                maxPolarAngle={config.orbitControls.maxPolarAngle}
                minAzimuthAngle={config.orbitControls.minAzimuthAngle}
                maxAzimuthAngle={config.orbitControls.maxAzimuthAngle}
                onStart={() => markInteracting(true)}
                onChange={() => markInteracting(true)}
                onEnd={() => markInteracting(false)}
            />

            {(showGrid ?? config.grid.enabled) && (
                <CanvasGrid settings={{ ...config.grid, enabled: showGrid ?? config.grid.enabled }} />
            )}
            <SlicePlaneHelper config={config.slicePlaneConfig} />

            <color attach="background" args={['#0a0a0a']} />

            <Bvh firstHitOnly>
                {children}
            </Bvh>

            <EffectComposer enableNormalPass={isDefectScene} multisampling={0} renderPriority={1}>
                {isDefectScene && <SSAO {...config.renderConfig.SSAO} />}
            </EffectComposer>
            </Canvas>
        </div>
    );
});

FractalScene.displayName = 'FractalScene';

export default React.memo(FractalScene);
