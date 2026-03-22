import useCameraGroup from './groups/camera';
import useEffectsGroup from './groups/effects';
import useEnvironmentGroup from './groups/environment';
import useGridGroup from './groups/grid';
import useLightsGroup from './groups/lights';
import useOrbitGroup from './groups/orbit';
import usePerformanceGroup from './groups/performance';
import usePointCloudGroup from './groups/point-clouds';
import useRendererGroup from './groups/renderer';
import { useMemo } from 'react';
import type { RenderGroup } from './types';

const useCanvasRenderGroups = (): RenderGroup[] => {
    const lightsGroup = useLightsGroup();
    const effectsGroup = useEffectsGroup();
    const performanceGroup = usePerformanceGroup();
    const environmentGroup = useEnvironmentGroup();
    const cameraGroup = useCameraGroup();
    const orbitGroup = useOrbitGroup();
    const rendererGroup = useRendererGroup();
    const pointCloudGroup = usePointCloudGroup();
    const gridGroup = useGridGroup();

    return useMemo<RenderGroup[]>(() => {
        return [
            lightsGroup,
            effectsGroup,
            performanceGroup,
            rendererGroup,
            pointCloudGroup,
            environmentGroup,
            cameraGroup,
            orbitGroup,
            gridGroup
        ];
    }, [
        lightsGroup,
        effectsGroup,
        performanceGroup,
        rendererGroup,
        pointCloudGroup,
        environmentGroup,
        cameraGroup,
        orbitGroup,
        gridGroup
    ]);
};

export default useCanvasRenderGroups;
