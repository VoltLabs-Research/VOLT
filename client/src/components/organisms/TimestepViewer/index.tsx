import React, { useState, useMemo, useCallback, useRef } from 'react';
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
    const slicePlaneConfig = useConfigurationStore(s => s.slicePlaneConfig);
    const sliceClippingPlanes = useSlicingPlanes(enableSlice, slicePlaneConfig);

    const sceneProps = useMemo(() => ({
        sliceClippingPlanes,
        position,
        rotation,
        scale,
        enableInstancing,
        updateThrottle,
    }), [sliceClippingPlanes, position, rotation, scale, enableInstancing, updateThrottle]);

    const { modelBounds } = useGlbScene(sceneProps);

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