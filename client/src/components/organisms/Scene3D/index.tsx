import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import CanvasGrid from '@/components/atoms/CanvasGrid';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import useEditorStore from '@/stores/editor';
import { AdaptiveDpr, Bvh, Preload } from '@react-three/drei';
import useUIStore from '@/stores/ui';
import './Scene3D.css';

interface Scene3DProps {
    children?: React.ReactNode;
    cameraControlsEnabled?: boolean;
    onCameraControlsRef?: (ref: any) => void;
}

const CAMERA_CONFIG = {
    position: [8, 6, 8] as [number, number, number],
    fov: 50,
    near: 0.1,
    far: 100
};

const GL_CONFIG = {
    localClippingEnabled: true,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance' as const,
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: true,
    desynchronized: true,
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

const Scene3D: React.FC<Scene3DProps> = ({
    children,
    cameraControlsEnabled = true,
    onCameraControlsRef
}) => {
    const orbitControlsRef = useRef<any>(null);
    const activeSceneObject = useEditorStore(state => state.activeSceneObject);
    const showCanvasGrid = useUIStore((state) => state.showCanvasGrid);
    const toggleCanvasGrid = useUIStore((state) => state.toggleCanvasGrid);
    const toggleEditorWidgets = useUIStore((state) => state.toggleEditorWidgets);
    const showEditorWidgets = useUIStore((state) => state.showEditorWidgets);

    const maxDpr = useMemo(() => (window.devicePixelRatio > 1 ? 2 : 1), []);

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
        backgroundColor: !showEditorWidgets ? '#e6e6e6' : '#1E1E1E',
        touchAction: 'none',
        willChange: 'transform',
        transform: 'translateZ(0)'
    }), [showEditorWidgets]);

    const orbitControlsProps = useMemo(() => ({
        ...ORBIT_CONTROLS_CONFIG,
        enabled: cameraControlsEnabled
    }), [cameraControlsEnabled]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleCanvasGrid(prev => !prev);
            }

            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                toggleEditorWidgets(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
            <Preload all />
            <AdaptiveDpr pixelated />
            
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
};

export default React.memo(Scene3D);