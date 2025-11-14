import React, { useMemo, forwardRef, useImperativeHandle } from 'react';
import CameraManager from '@/components/atoms/scene/CameraManager';
import useSlicingPlanes from '@/hooks/canvas/use-slicing-planes';
import useGlbScene from '@/hooks/canvas/use-glb-scene';

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
    centerModelToCamera?: boolean;
}

export interface TimestepViewerRef {
    loadModel: () => void;
}

const TimestepViewer = forwardRef<TimestepViewerRef, TimestepViewerProps>(({
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,
    enableSlice = true,
    enableInstancing = true,
    updateThrottle = 16,
}, ref) => {
    const sliceClippingPlanes = useSlicingPlanes(enableSlice);

    const sceneProps = useMemo(() => ({
        sliceClippingPlanes,
        position: {
            x: position.x || 0,
            y: position.y || 0,
            z: position.z || 0
        },
        rotation: {
            x: rotation.x || 0,
            y: rotation.y || 0,
            z: rotation.z || 0
        },
        scale,
        enableInstancing,
        updateThrottle,
    }), [sliceClippingPlanes, position, rotation, scale, enableInstancing, updateThrottle]);

    const { modelBounds, resetModel } = useGlbScene(sceneProps);

    useImperativeHandle(ref, () => ({
        loadModel: () => {
            // Usar los métodos del hook según necesites
            resetModel();
        }
    }), [resetModel]);

    const shouldRenderCamera = useMemo(() => 
        autoFit && modelBounds, 
        [autoFit, modelBounds]
    );

    return (
        <>
            {shouldRenderCamera && (
                <CameraManager 
                    modelBounds={modelBounds || undefined} 
                    orbitControlsRef={orbitControlsRef} 
                    face='ny'
                />
            )}
        </>
    );
});

TimestepViewer.displayName = 'TimestepViewer';

export default TimestepViewer;