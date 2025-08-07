import React, { useEffect, useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import CanvasGrid from '@/components/atoms/scene/CanvasGrid';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import useConfigurationStore from '@/stores/editor/configuration';
import { AdaptiveDpr, Bvh, Preload } from '@react-three/drei';
import useUIStore from '@/stores/ui';
import './Scene3D.css';

interface Scene3DProps {
    children?: React.ReactNode;
    cameraControlsEnabled?: boolean;
    showGizmo?: boolean;
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
}

const CAMERA_CONFIG = {
    position: [8, 6, 8] as [number, number, number],
    fov: 50,
    near: 0.1,
    far: 100
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
    onScreenshotReady: (fn: any) => void;
    backgroundColor: string;
}> = ({ onScreenshotReady, backgroundColor }) => {
    const { gl, scene, camera, size } = useThree();

    const captureScreenshot = useCallback((options?: any) => {
        const safeOptions = options || {};
        const {
            width,
            height,
            format = 'png',
            quality = 1.0,
            // TODO:
            zoomFactor = 1.0
        } = safeOptions;

        return new Promise<string>((resolve, reject) => {
            try{
                const originalPosition = camera.position.clone();
                const originalZoom = camera.zoom;
                const originalFov = camera.fov;

                // Force a render with the new camera settings
                gl.render(scene, camera);
                
                // Wait for a frame to ensure everything is rendered
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
                            
                            const tempCtx = tempCanvas.getContext('2d');
                            if(!tempCtx){
                                camera.position.copy(originalPosition);
                                camera.zoom = originalZoom;
                                camera.fov = originalFov;
                                camera.updateProjectionMatrix();
                                reject(new Error('No se pudo obtener el contexto 2D del canvas temporal'));
                                return;
                            }
                            
                            if(format === 'jpeg'){
                                tempCtx.fillStyle = backgroundColor || '#1E1E1E';
                                tempCtx.fillRect(0, 0, targetWidth, targetHeight);
                            }
                            
                            // Draw the original canvas on the temporary one
                            tempCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
                            finalCanvas = tempCanvas;
                        }
                        
                        // TODO: duplicated code
                        const mimeType = `image/${format}`;
                        const dataURL = finalCanvas.toDataURL(mimeType, quality);
                        
                        // Restore the camera to its original state
                        camera.position.copy(originalPosition);
                        camera.zoom = originalZoom;
                        camera.fov = originalFov;
                        camera.updateProjectionMatrix();
                        
                        // Render once more to restore the original view
                        gl.render(scene, camera);
                        
                        // Verificar que el dataURL tenga contenido válido
                        if(dataURL === 'data:,' || dataURL.length < 100){
                            reject(new Error('The canvas is empty or could not be captured'));
                            return;
                        }
                        
                        resolve(dataURL);
                    }catch(innerError){
                        // Restore the camera in case of error
                        camera.position.copy(originalPosition);
                        camera.zoom = originalZoom;
                        camera.fov = originalFov;
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
        if (typeof onScreenshotReady === 'function') {
            onScreenshotReady(captureScreenshot);
        }
    }, [captureScreenshot, onScreenshotReady]);

    return null;
};

const Scene3D = forwardRef<Scene3DRef, Scene3DProps>(({
    children,
    showGizmo = true,
    cameraControlsEnabled = true,
    onCameraControlsRef
}, ref) => {
    const orbitControlsRef = useRef<any>(null);
    const [screenshotCapture, setScreenshotCapture] = useState<((options?: any) => Promise<string>) | null>(null);
    const activeSceneObject = useConfigurationStore(state => state.activeSceneObject);
    const showCanvasGrid = useUIStore((state) => state.showCanvasGrid);
    const toggleCanvasGrid = useUIStore((state) => state.toggleCanvasGrid);
    const toggleEditorWidgets = useUIStore((state) => state.toggleEditorWidgets);
    const showEditorWidgets = useUIStore((state) => state.showEditorWidgets);

    const maxDpr = useMemo(() => (window.devicePixelRatio > 1 ? 2 : 1), []);

    const backgroundColor = useMemo(() => 
        !showEditorWidgets ? '#e6e6e6' : '#1E1E1E'
    , [showEditorWidgets]);

    const handleScreenshotReady = useCallback((captureFunction: (options?: any) => Promise<string>) => {
        setScreenshotCapture(() => captureFunction);
    }, []);

    useImperativeHandle(ref, () => ({
        captureScreenshot: (options) => {
            if(screenshotCapture && typeof screenshotCapture === 'function'){
                return screenshotCapture(options);
            }
            
            return Promise.reject(new Error('Screenshot not available yet.'));
        }
    }), [screenshotCapture]);

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

            // TODO: It occurs to me that there may be global settings in a scene, 
            // so that when saving it they are updated in the cloud and everyone 
            // can have the same settings.
            if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 's'){
                e.preventDefault();
                if(screenshotCapture && typeof screenshotCapture === 'function'){
                    screenshotCapture({
                        format: 'png',
                        quality: 1.0
                    });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [screenshotCapture, toggleCanvasGrid, toggleEditorWidgets]);

    return (
        <Canvas
            gl={GL_CONFIG}
            shadows='basic'
            camera={CAMERA_CONFIG}
            style={canvasStyle}
            dpr={[0.8, maxDpr]}
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
                onScreenshotReady={handleScreenshotReady} 
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