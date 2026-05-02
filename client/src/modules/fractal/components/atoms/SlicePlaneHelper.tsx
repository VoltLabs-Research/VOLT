import * as THREE from 'three';
import { useEffect, useMemo, useState } from 'react';
import { getSlicePlaneVisualizationQuaternion, getSlicePlaneVisualizationSize, resolveSlicePlaneDefinition } from '@/modules/fractal/utilities/slice-plane';
import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/types/configuration';
import type { FC } from 'react';

interface SlicePlaneHelperProps {
    config: SlicePlaneConfig;
    modelWorldBounds?: ModelWorldBounds | null;
}

const SlicePlaneHelper: FC<SlicePlaneHelperProps> = ({ config, modelWorldBounds }) => {
    const slicePlane = useMemo(() => resolveSlicePlaneDefinition(config), [config]);
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());

    useEffect(() => subscribeToAppTheme(setTheme), []);

    const planeStyle = useMemo(() => {
        if (theme === Theme.Light) {
            return {
                color: '#121212',
                fillOpacity: 0.08,
                edgeOpacity: 0.32
            };
        }

        return {
            color: '#ffffff',
            fillOpacity: 0.06,
            edgeOpacity: 0.2
        };
    }, [theme]);

    const planeQuaternion = useMemo(() => {
        if (!slicePlane) {
            return null;
        }

        return getSlicePlaneVisualizationQuaternion(slicePlane.normal);
    }, [slicePlane]);

    const planeSize = useMemo(() => getSlicePlaneVisualizationSize(modelWorldBounds), [modelWorldBounds]);
    const planeGeometry = useMemo(() => new THREE.PlaneGeometry(planeSize, planeSize), [planeSize]);
    const planeEdgesGeometry = useMemo(() => new THREE.EdgesGeometry(planeGeometry), [planeGeometry]);

    if (!slicePlane || !config.visualizePlane || !planeQuaternion) {
        return null;
    }

    return (
        <group position={slicePlane.point} quaternion={planeQuaternion}>
            <mesh geometry={planeGeometry}>
                <meshBasicMaterial
                    color={planeStyle.color}
                    transparent
                    opacity={planeStyle.fillOpacity}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <lineSegments geometry={planeEdgesGeometry}>
                <lineBasicMaterial
                    color={planeStyle.color}
                    transparent
                    opacity={planeStyle.edgeOpacity}
                    depthWrite={false}
                    toneMapped={false}
                />
            </lineSegments>
        </group>
    );
};

export default SlicePlaneHelper;
