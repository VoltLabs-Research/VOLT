import React, { useEffect, useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import CanvasGrid from '@/components/atoms/scene/CanvasGrid';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import useConfigurationStore from '@/stores/editor/configuration';
import { AdaptiveDpr, Bvh, Preload } from '@react-three/drei';
import useEditorUIStore from '@/stores/ui/editor';
import useTimestepStore from '@/stores/editor/timesteps';
import { calculateClosestCameraPositionZY } from '@/utilities/glb/modelUtils';
import TetrahedronLoader from '@/components/atoms/TetrahedronLoader';
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

const CAMERA_CONFIG = {
    position: [8, 8, 6] as [number, number, number],
    fov: 50,
    near: 0.1,
    far: 100,
    up: [0, 0, 1] as [number, number, number],
};

const GL_CONFIG = {
    localClippingEnabled: true,
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance' as const,
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: true,
    desynchronized: false,
    precision: 'lowp',
    xrCompatible: false,
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: false,
};

const SSAO_CONFIG = {
    blendFunction: BlendFunction.MULTIPLY,
    intensity: 5,
    radius: 0.1,
    luminanceInfluence: 0.5,
    worldDistanceThreshold: 0.5,
    worldDistanceFalloff: 0.3,
    worldProximityThreshold: 0.5,
    worldProximityFalloff: 0.3
};

const ORBIT_CONTROLS_CONFIG = {
    makeDefault: true,
    enableDamping: true,
    dampingFactor: 0.08,
    rotateSpeed: 1.0,
    maxDistance: 50,
    minDistance: 2,
    target: [0, 2, 0] as [number, number, number],
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
};

const DefectLighting = React.memo(() => (
    <>
        <ambientLight intensity={0.15} />
        <directionalLight
            castShadow
            position={[10, 15, -5]}
            intensity={2.0}
            shadow-mapSize={[256, 256]}
            shadow-bias={-0.0001}
            shadow-camera-near={1}
            shadow-camera-far={30}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
        />
        <directionalLight
            position={[-10, 5, 10]}
            intensity={0.2}
        />
        <EffectComposer enableNormalPass multisampling={0} renderPriority={1}>
            <SSAO {...SSAO_CONFIG} />
        </EffectComposer>
    </>
));

const TrajectoryLighting = React.memo(() => (
    <>
        <ambientLight intensity={0.8} />
        <directionalLight
            castShadow
            position={[15, 15, 15]}
            intensity={2.0}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={100}
            shadow-camera-near={1}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
        />
        <directionalLight
            position={[-10, 10, -10]}
            intensity={0.8}
            color="#ffffff"
        />
        <hemisphereLight
            groundColor="#362d1d"
            intensity={0.5}
        />
    </>
));

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
    const [tools, setTools] = useState<{ captureScreenshot: (options?: any) => Promise<string>; waitForVisibleFrame: () => Promise<void>; markContentReady: () => void; waitForContentFrame: () => Promise<void> } | null>(null);
    const activeSceneObject = useConfigurationStore(state => state.activeSceneObject);
    const toggleCanvasGrid = useEditorUIStore((state) => state.toggleCanvasGrid);
    const toggleEditorWidgets = useEditorUIStore((state) => state.toggleEditorWidgets);
    const showEditorWidgets = useEditorUIStore((state) => state.showEditorWidgets);
    const modelBounds = useTimestepStore((state) => state.modelBounds);

    const maxDpr = useMemo(() => (window.devicePixelRatio > 1 ? 2 : 1), []);

    const backgroundColor = useMemo(() => {
        if(background !== null){
            return background;
        }

        return !showEditorWidgets ? '#e6e6e6' : '#1E1E1E'
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
        ['defect_mesh', 'interface_mesh'].includes(activeSceneObject), 
        [activeSceneObject]
    );

    const isTrajectoryScene = useMemo(() => 
        ['trajectory', 'atoms_colored_by_type', 'dislocations'].includes(activeSceneObject), 
        [activeSceneObject]
    );

    const canvasStyle = useMemo(() => ({
        backgroundColor,
        touchAction: 'none',
        willChange: 'transform',
        transform: 'translateZ(0)'
    }), [backgroundColor]);

    const orbitControlsProps = useMemo(() => ({
        ...ORBIT_CONTROLS_CONFIG,
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
                        modelBounds.box,
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
    }, [tools, toggleCanvasGrid, toggleEditorWidgets, modelBounds]);

    return (
        <Canvas
            gl={GL_CONFIG}
            shadows='basic'
            camera={CAMERA_CONFIG}
            style={canvasStyle}
            dpr={[maxDpr, maxDpr]}
            frameloop='always'
            flat={true}
            performance={{
                current: 1,
                min: 0.1,
                max: 1,
                debounce: 50,
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
                    <ambientLight intensity={1.5} />

                    <GizmoViewport 
                        scale={30}
                        hideNegativeAxes={true}
                        axisColors={['#404040', '#404040', '#404040']} 
                        labelColor="#a2a2a2" />
                </GizmoHelper>
            )}

            {isDefectScene && <DefectLighting />}
            {isTrajectoryScene && <TrajectoryLighting />}

            <OrbitControls
                ref={handleControlsRef}
                {...orbitControlsProps}
                {...orbitControlsConfig}
            />
            
            {showCanvasGrid && <CanvasGrid />}
            
            <Bvh firstHitOnly>
                {children}
            </Bvh>

            <EffectComposer enableNormalPass={isDefectScene} multisampling={0} renderPriority={1}>
                {isDefectScene && <SSAO {...SSAO_CONFIG} />}
            </EffectComposer>
        </Canvas>
    );
});

Scene3D.displayName = 'Scene3D';

export default React.memo(Scene3D);
