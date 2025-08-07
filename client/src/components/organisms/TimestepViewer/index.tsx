import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Material } from 'three';
import CameraManager from '@/components/atoms/scene/CameraManager';
import useSlicingPlanes from '@/hooks/canvas/use-slicing-planes';
import { useGlbScene } from '@/hooks/canvas/use-glb-scene';
import useConfigurationStore from '@/stores/editor/configuration';

interface TimestepViewerProps {
    rotation?: { x?: number; y?: number; z?: number };
    position?: { x?: number; y?: number; z?: number };
    scale?: number;
    autoFit?: boolean;
    orbitControlsRef?: React.RefObject<any>;
    enableSlice?: boolean;
    enableInstancing?: boolean;
    instanceCount?: number;
    updateThrottle?: number;
}

const AtomCounter = React.memo<{ 
    atomCount: number; 
    visibleCount: number; 
    isLoading: boolean;
    progress: number;
}>(({ atomCount, visibleCount, isLoading, progress }) => {
    if (!atomCount && !isLoading) return null;
    
    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            zIndex: 1000,
            pointerEvents: 'none'
        }}>
            {isLoading ? (
                <div>Loading: {progress}%</div>
            ) : (
                <>
                    <div>Atoms: {atomCount.toLocaleString()}</div>
                    <div>Visible: {visibleCount.toLocaleString()}</div>
                    <div>Culled: {(atomCount - visibleCount).toLocaleString()}</div>
                </>
            )}
        </div>
    );
});

const PerformanceMonitor = React.memo(() => {
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());
    const [fps, setFps] = useState(60);

    useFrame(() => {
        frameCount.current++;
        const now = performance.now();
        
        if (now - lastTime.current >= 1000) {
            const currentFps = Math.round((frameCount.current * 1000) / (now - lastTime.current));
            setFps(currentFps);
            frameCount.current = 0;
            lastTime.current = now;
        }
    });

    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: fps < 20 ? 'rgba(255,0,0,0.7)' : fps < 40 ? 'rgba(255,165,0,0.7)' : 'rgba(0,128,0,0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            zIndex: 1000,
            pointerEvents: 'none'
        }}>
            FPS: {fps}
        </div>
    );
});

const TimestepViewer: React.FC<TimestepViewerProps> = ({
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing = true,
    updateThrottle = 16,
}) => {
    const [geometryData, setGeometryData] = useState<{ 
        geometry: BufferGeometry | null; 
        material: Material | null;
        instanceCount: number;
    }>({ geometry: null, material: null, instanceCount: 0 });

    const slicePlaneConfig = useConfigurationStore(s => s.slicePlaneConfig);
    const sliceClippingPlanes = useSlicingPlanes(enableSlice, slicePlaneConfig);

    const handleGeometryReady = useCallback((data: { 
        geometry: BufferGeometry; 
        material: Material;
        instanceCount: number;
    }) => {
        setGeometryData(prev => {
            if (prev.geometry !== data.geometry || 
                prev.material !== data.material || 
                prev.instanceCount !== data.instanceCount) {
                return data;
            }
            return prev;
        });
    }, []);

    const sceneProps = useMemo(() => ({
        sliceClippingPlanes,
        position,
        rotation,
        scale,
        enableInstancing,
        onGeometryReady: handleGeometryReady,
        updateThrottle,
    }), [sliceClippingPlanes, position, rotation, scale, enableInstancing, handleGeometryReady, updateThrottle]);

    const { 
        modelBounds, 
        isLoading, 
        loadProgress, 
        atomCount, 
        visibleAtomCount 
    } = useGlbScene(sceneProps);

    const shouldRenderCamera = useMemo(() => 
        autoFit && modelBounds, 
        [autoFit, modelBounds]
    );

    return (
        <>
            {shouldRenderCamera && (
                <CameraManager 
                    modelBounds={modelBounds} 
                    orbitControlsRef={orbitControlsRef} 
                />
            )}
        </>
    );
};

export default React.memo(TimestepViewer, (prevProps, nextProps) => {
    return (
        prevProps.scale === nextProps.scale &&
        prevProps.autoFit === nextProps.autoFit &&
        prevProps.enableSlice === nextProps.enableSlice &&
        prevProps.enableInstancing === nextProps.enableInstancing &&
        prevProps.updateThrottle === nextProps.updateThrottle &&
        JSON.stringify(prevProps.position) === JSON.stringify(nextProps.position) &&
        JSON.stringify(prevProps.rotation) === JSON.stringify(nextProps.rotation)
    );
});