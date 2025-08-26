import React, { useMemo } from 'react';
import CameraManager from '@/components/atoms/scene/CameraManager';
import useSlicingPlanes from '@/hooks/canvas/use-slicing-planes';
import { useGlbScene } from '@/hooks/canvas/use-glb-scene';
import useConfigurationStore from '@/stores/editor/configuration';
import useModelStore from '@/stores/editor/model';

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

const TimestepViewer: React.FC<TimestepViewerProps> = ({
    rotation = {},
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    autoFit = true,
    orbitControlsRef,
    centerCamera = true,
    enableSlice = true,
    enableInstancing = true,
    updateThrottle = 16,
}) => {
    const slicePlaneConfig = useConfigurationStore(s => s.slicePlaneConfig);
    const sliceClippingPlanes = useSlicingPlanes(enableSlice, slicePlaneConfig);
    const activeScene = useModelStore((state) => state.activeScene);

    const sceneProps = useMemo(() => ({
        activeScene,
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
                    centerCamera={centerCamera}
                    modelBounds={modelBounds} 
                    orbitControlsRef={orbitControlsRef} 
                    face='ny'
                />
            )}
        </>
    );
};

export default TimestepViewer;