import React, {
    useEffect,
    useMemo,
    useState,
    useRef,
    useCallback,
    forwardRef,
    useImperativeHandle
} from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, AdaptiveDpr, AdaptiveEvents, Bvh, Preload } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import TrajectoryLighting from '@/modules/canvas/presentation/components/atoms/TrajectoryLighting';
import DefectLighting from '@/modules/canvas/presentation/components/atoms/DefectLighting';
import CanvasGrid from '@/modules/canvas/presentation/components/atoms/CanvasGrid';
import SlicePlaneHelper from '@/modules/canvas/presentation/components/atoms/SlicePlaneHelper';
import DynamicEffects from '@/modules/canvas/presentation/components/molecules/DynamicEffects';
import DynamicEnvironment from '@/modules/canvas/presentation/components/molecules/DynamicEnvironment';
import DynamicLights from '@/modules/canvas/presentation/components/molecules/DynamicLights';
import DynamicBackground from '@/modules/canvas/presentation/components/molecules/DynamicBackground';
import DynamicRenderer from '@/modules/canvas/presentation/components/molecules/DynamicRenderer';
import CameraRig from '@/modules/canvas/presentation/components/atoms/CameraRig';
import PerformanceStatsCollector from '@/modules/canvas/presentation/components/atoms/PerformanceStatsCollector';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { calculateClosestCameraPositionZY } from '@/modules/canvas/presentation/utilities/modelUtils';
import '@/modules/canvas/presentation/components/organisms/Scene3D/Scene3D.css';

interface Scene3DProps {
    children?: React.ReactNode;
    cameraControlsEnabled?: boolean;
    background?: string;
    cssBackground?: string;
    showGizmo?: boolean;
    orbitControlsConfig?: any;
    showCanvasGrid?: boolean;
    onCameraControlsRef?: (ref: any) => void;
}

export interface Scene3DRef {
    captureScreenshot: (options?: {
        width?: number;
        height?: number;
        format?: 'png' | 'jpeg' | 'webp';
        quality?: number;
        fileName?: string;
        download?: boolean;
        zoomFactor?: number;
    } | null) => Promise<string>;
    waitForVisibleFrame: () => Promise<void>;
    markContentReady: () => void;
    waitForContentFrame: () => Promise<void>;
    zoomTo: (zoomFactor: number) => void;
    getCurrentZoom: () => number;
}

const Scene3D = forwardRef<Scene3DRef, Scene3DProps>(({
    children,
    showGizmo = true,
    background = null,
    cssBackground,
    cameraControlsEnabled = true,
    showCanvasGrid = true,
    orbitControlsConfig = {},
    onCameraControlsRef
}, ref) => {
    const orbitControlsRef = useRef<any>(null);
    const interactionTimeoutRef = useRef<number | null>(null);
    const initialDistanceRef = useRef<number | null>(null);

    const [tools, setTools] = useState<{
        captureScreenshot: (options?: any) => Promise<string>;
        waitForVisibleFrame: () => Promise<void>;
        markContentReady: () => void;
        waitForContentFrame: () => Promise<void>;
    } | null>(null);

    const activeScene = useEditorStore((s) => s.activeScene);
    const activeModel = useEditorStore((s) => s.activeModel);

    const toggleCanvasGrid = useCanvasUIStore((s) => s.toggleCanvasGrid);
    const toggleEditorWidgets = useCanvasUIStore((s) => s.toggleEditorWidgets);
    const setSceneInteracting = useCanvasUIStore((s) => s.setSceneInteracting);
    const isInteracting = useCanvasUIStore((s) => s.isSceneInteracting);

    useEditorStore((s) => s.camera.type);
    useEditorStore((s) => s.camera.position);
    useEditorStore((s) => s.camera.up);

    const dprCfg = useEditorStore((s) => s.performanceSettings.dpr);
    const perf = useEditorStore((s) => s.performanceSettings.performance);
    const interactionDegradeEnabled = useEditorStore((s) => s.performanceSettings.interactionDegrade.enabled);
    const powerPreference = useEditorStore((s) => s.performanceSettings.canvas.powerPreference);
    const adaptiveEventsEnabled = useEditorStore((s) => s.performanceSettings.adaptiveEvents.enabled);

    const rCreate = useEditorStore((s) => s.rendererSettings.create);

    const ocEnabled = useEditorStore((s) => s.orbitControls.enabled);
    const ocEnableDamping = useEditorStore((s) => s.orbitControls.enableDamping);
    const ocDampingFactor = useEditorStore((s) => s.orbitControls.dampingFactor);
    const ocEnableZoom = useEditorStore((s) => s.orbitControls.enableZoom);
    const ocZoomSpeed = useEditorStore((s) => s.orbitControls.zoomSpeed);
    const ocEnableRotate = useEditorStore((s) => s.orbitControls.enableRotate);
    const ocRotateSpeed = useEditorStore((s) => s.orbitControls.rotateSpeed);
    const ocEnablePan = useEditorStore((s) => s.orbitControls.enablePan);
    const ocPanSpeed = useEditorStore((s) => s.orbitControls.panSpeed);
    const ocScreenSpacePanning = useEditorStore((s) => s.orbitControls.screenSpacePanning);
    const ocAutoRotate = useEditorStore((s) => s.orbitControls.autoRotate);
    const ocAutoRotateSpeed = useEditorStore((s) => s.orbitControls.autoRotateSpeed);
    const ocMinDistance = useEditorStore((s) => s.orbitControls.minDistance);
    const ocMaxDistance = useEditorStore((s) => s.orbitControls.maxDistance);
    const ocMinPolar = useEditorStore((s) => s.orbitControls.minPolarAngle);
    const ocMaxPolar = useEditorStore((s) => s.orbitControls.maxPolarAngle);
    const ocMinAzimuth = useEditorStore((s) => s.orbitControls.minAzimuthAngle);
    const ocMaxAzimuth = useEditorStore((s) => s.orbitControls.maxAzimuthAngle);
    const ocTarget = useEditorStore((s) => s.orbitControls.target);

    const dpr = useMemo(() => {
        if (dprCfg.mode === 'fixed') return dprCfg.fixed;
        const min = (isInteracting && interactionDegradeEnabled) ? Math.min(dprCfg.interactionMin, dprCfg.min) : dprCfg.min;
        return [min, dprCfg.max] as [number, number];
    }, [dprCfg.mode, dprCfg.fixed, dprCfg.min, dprCfg.max, dprCfg.interactionMin, interactionDegradeEnabled, isInteracting]);

    const adaptiveEnabled = dprCfg.mode === 'adaptive';
    const pixelated = dprCfg.pixelated;

    const markInteractingNow = useCallback(() => { setSceneInteracting(true); }, [setSceneInteracting]);

    const markInteractingDebounced = useCallback(() => {
        setSceneInteracting(true);
        if (interactionTimeoutRef.current) window.clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = window.setTimeout(() => {
            setSceneInteracting(false);
            interactionTimeoutRef.current = null;
        }, 100);
    }, [setSceneInteracting]);

    const endInteracting = useCallback(() => {
        if (interactionTimeoutRef.current) {
            window.clearTimeout(interactionTimeoutRef.current);
            interactionTimeoutRef.current = null;
        }
        setSceneInteracting(false);
    }, [setSceneInteracting]);

    const backgroundColor = useMemo(() => {
        if (background !== null && background !== undefined) return background;
        return '#0a0a0a';
    }, [background]);

    useImperativeHandle(ref, () => ({
        captureScreenshot: (options) => {
            if (tools && typeof tools.captureScreenshot === 'function') return tools.captureScreenshot(options);
            return Promise.reject(new Error('Screenshot not available yet.'));
        },
        waitForVisibleFrame: () => tools?.waitForVisibleFrame?.() ?? Promise.resolve(),
        markContentReady: () => tools?.markContentReady?.(),
        waitForContentFrame: () => tools?.waitForContentFrame?.() ?? Promise.resolve(),
        zoomTo: (zoomPercent: number) => {
            if (!orbitControlsRef.current) return;
            const controls = orbitControlsRef.current;
            const camera = controls.object as THREE.PerspectiveCamera;

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
            const camera = controls.object as THREE.PerspectiveCamera;

            if (!initialDistanceRef.current) {
                initialDistanceRef.current = camera.position.distanceTo(controls.target);
            }

            const currentDistance = camera.position.distanceTo(controls.target);

            const zoomPercent = (initialDistanceRef.current * 100) / currentDistance;

            const roundedZoom = Math.round(zoomPercent / 5) * 5;

            return Math.max(10, Math.min(1000, roundedZoom));
        }
    }), [tools]);

    const handleControlsRef = useCallback((r: any) => {
        orbitControlsRef.current = r;
        onCameraControlsRef?.(r);
    }, [onCameraControlsRef]);

    useEffect(() => {
        if (!orbitControlsRef.current) return;
        orbitControlsRef.current.target.set(ocTarget[0], ocTarget[1], ocTarget[2]);
        orbitControlsRef.current.update();
    }, [ocTarget[0], ocTarget[1], ocTarget[2]]);

    useEffect(() => {
        const initializeZoom = () => {
            if (!orbitControlsRef.current || initialDistanceRef.current) return true;
            const controls = orbitControlsRef.current;
            const camera = controls.object as any;
            initialDistanceRef.current = camera.position.distanceTo(controls.target);
            return true;
        };

        if (!initializeZoom()) {
            const timer = setTimeout(initializeZoom, 100);
            return () => clearTimeout(timer);
        }
    }, []);

    const { isDefectScene, isTrajectoryScene } = useMemo(() => {
        return { isDefectScene: false, isTrajectoryScene: true };
    }, [activeScene]);

    const canvasStyle = useMemo(() => ({
        width: '100%',
        height: '100%',
        touchAction: 'none',
        willChange: 'transform',
        transform: 'translateZ(0)'
    }), [backgroundColor, cssBackground]);

    const threeBackgroundColor = useMemo(() => {
        if (cssBackground && rCreate.alpha) return 'transparent';
        return backgroundColor;
    }, [cssBackground, rCreate.alpha, backgroundColor]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleCanvasGrid(); }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); toggleEditorWidgets(); }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (orbitControlsRef.current) {
                    const optimal = calculateClosestCameraPositionZY(activeModel?.modelBounds?.box, orbitControlsRef.current.object);
                    orbitControlsRef.current.object.position.copy(optimal.position);
                    orbitControlsRef.current.target.copy(optimal.target);
                    orbitControlsRef.current.object.up.copy(optimal.up);
                    orbitControlsRef.current.object.lookAt(optimal.target);
                    orbitControlsRef.current.update();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown); };
    }, [toggleCanvasGrid, toggleEditorWidgets, activeModel]);

    useEffect(() => {
        const handleCameraCommand = (e: CustomEvent<{ command: string }>) => {
            if (!orbitControlsRef.current) return;

            const { command } = e.detail;

            if (command === 'reset-camera') {
                orbitControlsRef.current.object.position.set(8, 8, 6);
                orbitControlsRef.current.object.up.set(0, 0, 1);
                orbitControlsRef.current.target.set(0, 0, 0);
                orbitControlsRef.current.object.lookAt(0, 0, 0);
                orbitControlsRef.current.update();
            }
        };

        window.addEventListener('Volt:camera-command', handleCameraCommand as EventListener);
        return () => {
            window.removeEventListener('Volt:camera-command', handleCameraCommand as EventListener);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (interactionTimeoutRef.current) {
                window.clearTimeout(interactionTimeoutRef.current);
            }
        };
    }, []);

    const glProps = useMemo(() => ({
        antialias: rCreate.antialias,
        alpha: rCreate.alpha,
        depth: rCreate.depth,
        stencil: rCreate.stencil,
        logarithmicDepthBuffer: rCreate.logarithmicDepthBuffer,
        preserveDrawingBuffer: rCreate.preserveDrawingBuffer,
        premultipliedAlpha: rCreate.premultipliedAlpha,
        failIfMajorPerformanceCaveat: rCreate.failIfMajorPerformanceCaveat,
        precision: rCreate.precision,
        powerPreference
    }), [
        rCreate.antialias,
        rCreate.alpha,
        rCreate.depth,
        rCreate.stencil,
        rCreate.logarithmicDepthBuffer,
        rCreate.preserveDrawingBuffer,
        rCreate.premultipliedAlpha,
        rCreate.failIfMajorPerformanceCaveat,
        rCreate.precision,
        powerPreference
    ]);

    const canvasKey = useMemo(() => {
        return `canvas-${rCreate.antialias}-${rCreate.alpha}-${rCreate.depth}-${rCreate.stencil}-${rCreate.logarithmicDepthBuffer}-${rCreate.preserveDrawingBuffer}-${rCreate.premultipliedAlpha}-${rCreate.failIfMajorPerformanceCaveat}-${rCreate.precision}`;
    }, [
        rCreate.antialias,
        rCreate.alpha,
        rCreate.depth,
        rCreate.stencil,
        rCreate.logarithmicDepthBuffer,
        rCreate.preserveDrawingBuffer,
        rCreate.premultipliedAlpha,
        rCreate.failIfMajorPerformanceCaveat,
        rCreate.precision
    ]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas
                key={canvasKey}
                gl={glProps}
                style={canvasStyle}
                dpr={dpr}
                frameloop='demand'
                performance={perf}
                onCreated={() => {}}
            >
                <DynamicRenderer />
                <CameraRig orbitRef={orbitControlsRef} />
                <PerformanceStatsCollector />
                <color attach='background' args={[threeBackgroundColor]} />
                <Preload all />
                {adaptiveEnabled && <AdaptiveDpr pixelated={pixelated} />}
                {adaptiveEventsEnabled && <AdaptiveEvents />}

                {showGizmo && (
                    <GizmoHelper alignment='top-left' renderPriority={2} margin={[450, 70]}>
                        <directionalLight position={[5, 5, 5]} intensity={1} />
                        <ambientLight intensity={0.7} />
                        <GizmoViewport scale={30} hideNegativeAxes axisColors={['#2c2c2e', '#2c2c2e', '#2c2c2e']} labelColor='#8e8e93' />
                    </GizmoHelper>
                )}

                <DynamicBackground />
                <DynamicEffects />
                <DynamicLights />
                <DynamicEnvironment />

                {isDefectScene && <DefectLighting />}
                {isTrajectoryScene && <TrajectoryLighting />}

                <OrbitControls
                    ref={handleControlsRef}
                    enabled={ocEnabled && cameraControlsEnabled}
                    enableDamping={ocEnableDamping}
                    dampingFactor={ocDampingFactor}
                    enableZoom={ocEnableZoom}
                    zoomSpeed={ocZoomSpeed}
                    enableRotate={ocEnableRotate}
                    rotateSpeed={ocRotateSpeed}
                    enablePan={ocEnablePan}
                    panSpeed={ocPanSpeed}
                    screenSpacePanning={ocScreenSpacePanning}
                    autoRotate={ocAutoRotate}
                    autoRotateSpeed={ocAutoRotateSpeed}
                    minDistance={ocMinDistance}
                    maxDistance={ocMaxDistance}
                    minPolarAngle={ocMinPolar}
                    maxPolarAngle={ocMaxPolar}
                    minAzimuthAngle={ocMinAzimuth}
                    maxAzimuthAngle={ocMaxAzimuth}
                    onStart={markInteractingNow}
                    onChange={markInteractingDebounced}
                    onEnd={endInteracting}
                    {...orbitControlsConfig}
                />

                {showCanvasGrid && <CanvasGrid />}

                <SlicePlaneHelper />

                <Bvh firstHitOnly>
                    {children}
                </Bvh>

                <EffectComposer enableNormalPass={isDefectScene} multisampling={0} renderPriority={1}>
                    {isDefectScene && <SSAO {...useEditorStore.getState().renderConfig.SSAO} />}
                </EffectComposer>
            </Canvas>
        </div>
    );
});

Scene3D.displayName = 'Scene3D';
export default React.memo(Scene3D);
