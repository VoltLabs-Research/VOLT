import * as THREE from 'three';
import { useMemo } from 'react';
import { getSlicePlaneVisualizationQuaternion, getSlicePlaneVisualizationSize, resolveSlicePlaneDefinition } from '@/modules/fractal/utilities/slice-plane';
import type { SlicePlaneConfig, ModelWorldBounds } from '@/modules/fractal/types/configuration';
import type { FC } from 'react';

interface SlicePlaneHelperProps {
    config: SlicePlaneConfig;
    modelWorldBounds?: ModelWorldBounds | null;
};

const SlicePlaneHelper: FC<SlicePlaneHelperProps> = ({ config, modelWorldBounds }) => {
    const slicePlane = useMemo(() => resolveSlicePlaneDefinition(config), [config]);

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
                    color="#ffffff"
                    transparent
                    opacity={0.06}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <lineSegments geometry={planeEdgesGeometry}>
                <lineBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.2}
                    depthWrite={false}
                    toneMapped={false}
                />
            </lineSegments>
        </group>
    );
};

export default SlicePlaneHelper;
