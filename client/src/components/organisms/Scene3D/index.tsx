import React, {
    useEffect,
    useMemo,
    useState,
    useRef,
    useCallback,
    forwardRef,
    useImperativeHandle
} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, AdaptiveDpr, AdaptiveEvents, Bvh, Preload } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';

import ScreenshotHandler from '@/components/atoms/scene/ScreenshotHandler';
import TrajectoryLighting from '@/components/atoms/scene/TrajectoryLighting';
import DefectLighting from '@/components/atoms/scene/DefectLighting';
import CanvasGrid from '@/components/atoms/scene/CanvasGrid';
import DynamicEffects from '@/components/molecules/scene/DynamicEffects';
import DynamicEnvironment from '@/components/molecules/scene/DynamicEnvironment';
import DynamicBackground from '@/components/molecules/scene/DynamicBackground';
import CameraRig from '@/components/atoms/scene/CameraRig';

import useEditorUIStore from '@/stores/ui/editor';
import useModelStore from '@/stores/editor/model';
import useRenderConfigStore from '@/stores/editor/render-config';
import usePerformanceSettingsStore from '@/stores/editor/perfomance-settings';
import useCameraSettings, { buildR3FCameraProps } from '@/stores/editor/camera-config';

import { calculateClosestCameraPositionZY } from '@/utilities/glb/modelUtils';
import './Scene3D.css';

interface Scene3DProps {
    children?: React.ReactNode;
    cameraControlsEnabled?: boolean;
    background?: string;
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
}

const Scene3D = forwardRef<Scene3DRef, Scene3DProps>(({
    children,
    showGizmo = true,
    background = null,
    cameraControlsEnabled = true,
    showCanvasGrid = true,
    orbitControlsConfig = {},
    onCameraControlsRef
}, ref) => {
    const orbitControlsRef = useRef<any>(null);
    const interactionTimeoutRef = useRef<number | null>(null);

    const [tools, setTools] = useState<{
        captureScreenshot: (options?: any) => Promise<string>;
        waitForVisibleFrame: () => Promise<void>;
        markContentReady: () => void;
        waitForContentFrame: () => Promise<void>;
    } | null>(null);

    const activeScene = useModelStore((s) => s.activeScene);
    const activeModel = useModelStore((s) => s.activeModel);

    const toggleCanvasGrid = useEditorUIStore((s) => s.toggleCanvasGrid);
    const toggleEditorWidgets = useEditorUIStore((s) => s.toggleEditorWidgets);
    const showEditorWidgets = useEditorUIStore((s) => s.showEditorWidgets);
    const setSceneInteracting = useEditorUIStore((s) => s.setSceneInteracting);
    const isInteracting = useEditorUIStore((s) => s.sceneInteracting);

    const cameraState = useCameraSettings((s) => s);
    const cameraConfig = useMemo(() => buildR3FCameraProps(cameraState), [cameraState]);
    
    const glConfig = useRenderConfigStore((s) => s.gl);
    const orbitConfig = useRenderConfigStore((s) => s.orbitControls);
    const ssaoConfig = useRenderConfigStore((s) => s.SSAO);

    const dprCfg = usePerformanceSettingsStore((s) => s.dpr);
    const perf = usePerformanceSettingsStore((s) => s.performance);
    const interactionDegradeEnabled = usePerformanceSettingsStore((s) => s.interactionDegrade.enabled);
    const powerPreference = usePerformanceSettingsStore((s) => s.canvas.powerPreference);
    const adaptiveEventsEnabled = usePerformanceSettingsStore((s) => s.adaptiveEvents.enabled);

    const dpr = useMemo(() => {
        if (dprCfg.mode === 'fixed') return dprCfg.fixed;
        const min = (isInteracting && interactionDegradeEnabled)
            ? Math.min(dprCfg.interactionMin, dprCfg.min)
            : dprCfg.min;
        return [min, dprCfg.max] as [number, number];
    }, [
        dprCfg.mode,
        dprCfg.fixed,
        dprCfg.min,
        dprCfg.max,
        dprCfg.interactionMin,
        interactionDegradeEnabled,
        isInteracting
    ]);

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
        if (background !== null) return background;
        return !showEditorWidgets ? '#FFF' : '#1E1E1E';
    }, [showEditorWidgets, background]);

    const handleToolsReady = useCallback((t: {
        captureScreenshot: (options?: any) => Promise<string>;
        waitForVisibleFrame: () => Promise<void>;
        markContentReady: () => void;
        waitForContentFrame: () => Promise<void>;
    }) => { setTools(() => t); }, []);

    useImperativeHandle(ref, () => ({
        captureScreenshot: (options) => {
            if (tools && typeof tools.captureScreenshot === 'function') return tools.captureScreenshot(options);
            return Promise.reject(new Error('Screenshot not available yet.'));
        },
        waitForVisibleFrame: () => tools?.waitForVisibleFrame?.() ?? Promise.resolve(),
        markContentReady: () => tools?.markContentReady?.(),
        waitForContentFrame: () => tools?.waitForContentFrame?.() ?? Promise.resolve()
    }), [tools]);

    const handleControlsRef = useCallback((r: any) => {
        orbitControlsRef.current = r;
        onCameraControlsRef?.(r);
    }, [onCameraControlsRef]);

    const isDefectScene = useMemo(() => ['defect_mesh', 'interface_mesh'].includes(activeScene), [activeScene]);
    const isTrajectoryScene = useMemo(() => ['trajectory', 'atoms_colored_by_type', 'dislocations'].includes(activeScene), [activeScene]);

    const canvasStyle = useMemo(() => ({
        backgroundColor,
        touchAction: 'none',
        willChange: 'transform',
        transform: 'translateZ(0)'
    }), [backgroundColor]);

    const orbitControlsProps = useMemo(() => ({
        ...orbitConfig,
        enabled: cameraControlsEnabled
    }), [cameraControlsEnabled, orbitConfig]);

    const glMerged = useMemo(() => ({ ...glConfig, powerPreference }), [glConfig, powerPreference]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleCanvasGrid(); }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); toggleEditorWidgets(); }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (orbitControlsRef.current) {
                    const optimal = calculateClosestCameraPositionZY(activeModel?.modelBounds.box, orbitControlsRef.current.object);
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
    }, [tools, toggleCanvasGrid, toggleEditorWidgets, activeModel]);

    useEffect(() => {
        return () => {
            if (interactionTimeoutRef.current) {
                window.clearTimeout(interactionTimeoutRef.current);
            }
        };
    }, []);

    return (
        <Canvas
            gl={glMerged}
            shadows="basic"
            camera={cameraConfig}
            style={canvasStyle}
            dpr={dpr}
            frameloop="always"
            performance={perf}
            onCreated={({ gl }) => {
                gl.outputColorSpace = SRGBColorSpace;
                gl.toneMapping = ACESFilmicToneMapping;
                gl.toneMappingExposure = 5;
                gl.physicallyCorrectLights = true;
                gl.shadowMap.enabled = true;
                gl.shadowMap.type = PCFSoftShadowMap;
            }}
        >
            <CameraRig orbitRef={orbitControlsRef} /> 

            <ScreenshotHandler onToolsReady={handleToolsReady} backgroundColor={backgroundColor} />
            <color attach="background" args={[backgroundColor]} />
            <Preload all />

            {adaptiveEnabled && <AdaptiveDpr pixelated={pixelated} />}
            {adaptiveEventsEnabled && <AdaptiveEvents />}

            {showGizmo && (
                <GizmoHelper alignment="top-left" renderPriority={2} margin={[450, 70]}>
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <ambientLight intensity={2} />
                    <GizmoViewport
                        scale={30}
                        hideNegativeAxes
                        axisColors={['#404040', '#404040', '#404040']}
                        labelColor="#a2a2a2"
                    />
                </GizmoHelper>
            )}

            <DynamicBackground />
            <DynamicEffects />
            <DynamicEnvironment />

            {isDefectScene && <DefectLighting />}
            {isTrajectoryScene && <TrajectoryLighting />}

            <OrbitControls
                ref={handleControlsRef}
                {...orbitControlsProps}
                {...orbitControlsConfig}
                onStart={markInteractingNow}
                onChange={markInteractingDebounced}
                onEnd={endInteracting}
            />

            {showCanvasGrid && <CanvasGrid />}

            <Bvh firstHitOnly>
                {children}
            </Bvh>

            <EffectComposer enableNormalPass={isDefectScene} multisampling={0} renderPriority={1}>
                {isDefectScene && <SSAO {...ssaoConfig} />}
            </EffectComposer>
        </Canvas>
    );
});

Scene3D.displayName = 'Scene3D';
export default React.memo(Scene3D);
