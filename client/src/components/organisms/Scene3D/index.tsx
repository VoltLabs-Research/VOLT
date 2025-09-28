import React, { useEffect, useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { AdaptiveDpr, Bvh, Preload } from '@react-three/drei';
import { calculateClosestCameraPositionZY } from '@/utilities/glb/modelUtils';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import ScreenshotHandler from '@/components/atoms/scene/ScreenshotHandler';
import TrajectoryLighting from '@/components/atoms/scene/TrajectoryLighting';
import DefectLighting from '@/components/atoms/scene/DefectLighting';
import CanvasGrid from '@/components/atoms/scene/CanvasGrid';
import useEditorUIStore from '@/stores/ui/editor';
import useModelStore from '@/stores/editor/model';
import DynamicEffects from '@/components/molecules/scene/DynamicEffects';
import useRenderConfigStore from '@/stores/editor/render-config';
import DynamicEnvironment from '@/components/molecules/scene/DynamicEnvironment';
import DynamicBackground from '@/components/molecules/scene/DynamicBackground';
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

    const [tools, setTools] = useState<{ captureScreenshot: (options?: any) => Promise<string>; waitForVisibleFrame: () => Promise<void>; markContentReady: () => void; waitForContentFrame: () => Promise<void> } | null>(null);
    const activeScene = useModelStore(state => state.activeScene);
    const toggleCanvasGrid = useEditorUIStore((state) => state.toggleCanvasGrid);
    const toggleEditorWidgets = useEditorUIStore((state) => state.toggleEditorWidgets);
    const showEditorWidgets = useEditorUIStore((state) => state.showEditorWidgets);
    const activeModel = useModelStore((state) => state.activeModel);
    const cameraConfig = useRenderConfigStore((state) => state.camera);
    const glConfig = useRenderConfigStore((state) => state.gl);
    const orbitConfig = useRenderConfigStore((state) => state.orbitControls);
    const ssaoConfig = useRenderConfigStore((state) => state.SSAO);
    const setSceneInteracting = useEditorUIStore((state) => state.setSceneInteracting);

    const maxDpr = useMemo(() => (window.devicePixelRatio > 1 ? 2 : 1), []);

    const markInteractingNow = useCallback(() => {
        setSceneInteracting(true);
    }, [setSceneInteracting]);

    const markInteractingDebounced = useCallback(() => {
        setSceneInteracting(true);
        if(interactionTimeoutRef.current){
            window.clearTimeout(interactionTimeoutRef.current);
        }

        interactionTimeoutRef.current = window.setTimeout(() => {
            setSceneInteracting(false);
            interactionTimeoutRef.current = null;
        }, 100);
    }, [setSceneInteracting]);

    const endInteracting = useCallback(() => {
        if(interactionTimeoutRef.current){
            window.clearTimeout(interactionTimeoutRef.current);
            interactionTimeoutRef.current = null;
        }

        setSceneInteracting(false);
    }, [setSceneInteracting]);

    const backgroundColor = useMemo(() => {
        if(background !== null){
            return background;
        }   

        // 1E1E1E
        return !showEditorWidgets ? '#FFF' : '#1E1E1E'
    }, [showEditorWidgets, background]);

    const handleToolsReady = useCallback((t: { captureScreenshot: (options?: any) => Promise<string>; waitForVisibleFrame: () => Promise<void>; markContentReady: () => void; waitForContentFrame: () => Promise<void> }) => {
        setTools(() => t);
    }, []);

    
    useImperativeHandle(ref, () => ({
        captureScreenshot: (options) => {
            if(tools && typeof tools.captureScreenshot === 'function'){
                return tools.captureScreenshot(options);
            }
            return Promise.reject(new Error('Screenshot not available yet.'));
        },
        waitForVisibleFrame: () => {
            if(tools && typeof tools.waitForVisibleFrame === 'function'){
                return tools.waitForVisibleFrame();
            }
            return Promise.resolve();
        },
        markContentReady: () => {
            if(tools && typeof tools.markContentReady === 'function'){
                return tools.markContentReady();
            }
        },
        waitForContentFrame: () => {
            if(tools && typeof tools.waitForContentFrame === 'function'){
                return tools.waitForContentFrame();
            }
            return Promise.resolve();
        }
    }), [tools]);

    const handleControlsRef = useCallback((ref: any) => {
        orbitControlsRef.current = ref;
        onCameraControlsRef?.(ref);
    }, [onCameraControlsRef]);

    const isDefectScene = useMemo(() => 
        ['defect_mesh', 'interface_mesh'].includes(activeScene), 
        [activeScene]
    );

    const isTrajectoryScene = useMemo(() => 
        ['trajectory', 'atoms_colored_by_type', 'dislocations'].includes(activeScene), 
        [activeScene]
    );

    const canvasStyle = useMemo(() => ({
        backgroundColor,
        touchAction: 'none',
        willChange: 'transform',
        transform: 'translateZ(0)'
    }), [backgroundColor]);

    const orbitControlsProps = useMemo(() => ({
        ...orbitConfig,
        enabled: cameraControlsEnabled
    }), [cameraControlsEnabled]);

    useEffect(() => {

        const handleKeyDown = (e: KeyboardEvent) => {
            if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b'){
                e.preventDefault();
                toggleCanvasGrid();
            }

            if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n'){
                e.preventDefault();
                toggleEditorWidgets();
            }

            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (orbitControlsRef.current) {
                    const optimal = calculateClosestCameraPositionZY(
                        activeModel?.modelBounds.box,
                        orbitControlsRef.current.object
                    );

                    orbitControlsRef.current.object.position.copy(optimal.position);
                    orbitControlsRef.current.target.copy(optimal.target);
                    orbitControlsRef.current.object.up.copy(optimal.up);
                    orbitControlsRef.current.object.lookAt(optimal.target);
                    orbitControlsRef.current.update();
                }
            }

        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [tools, toggleCanvasGrid, toggleEditorWidgets, activeModel]);

    useEffect(() => {
        return () => {
            if(interactionTimeoutRef.current){
                window.clearTimeout(interactionTimeoutRef.current);
            }
        };
    }, []);

    return (
        <Canvas
            gl={glConfig}
            shadows='basic'
            camera={cameraConfig}
            style={canvasStyle}
            dpr={[maxDpr, maxDpr]}
            frameloop='always'
            performance={{
                current: 1,
                min: 0.1,
                max: 1,
                debounce: 50,
            }}
              onCreated={({ gl, scene }) => {
                gl.outputColorSpace = SRGBColorSpace;
                gl.toneMapping = ACESFilmicToneMapping;
                gl.toneMappingExposure = 5; 
                gl.physicallyCorrectLights = true;
                gl.shadowMap.enabled = true;
                gl.shadowMap.type = PCFSoftShadowMap;
            }}
        >
            <ScreenshotHandler 
                onToolsReady={handleToolsReady} 
                backgroundColor={backgroundColor}
            />
            
            <color attach="background" args={[backgroundColor]} />
            
            <Preload all />
            <AdaptiveDpr pixelated />
            {showGizmo && (
                <GizmoHelper
                    alignment='top-left'
                    renderPriority={2}
                    margin={[450, 70]} 
                >
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <ambientLight intensity={2} />

                    <GizmoViewport 
                        scale={30}
                        hideNegativeAxes={true}
                        axisColors={['#404040', '#404040', '#404040']} 
                        labelColor="#a2a2a2" />
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
