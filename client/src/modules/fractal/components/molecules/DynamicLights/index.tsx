import { LightingPreset } from '@/shared/rendering/lights';
import { useEffect, useRef } from 'react';
import type { DirectionalLight } from 'three';
import type { FC } from 'react';

interface DynamicLightsProps {
    preset?: LightingPreset;
    darkTheme: boolean;
}

const KEY_LIGHT_COLOR = '#f0f0f0';
const TRAJECTORY_FILL_COLOR = '#f0f0f0';
const DEFECT_FILL_COLOR = '#8e8e93';

const applyPresetShadow = (
    light: DirectionalLight,
    mapSize: number,
    far: number,
    bias?: number
): void => {
    light.shadow.mapSize.set(mapSize, mapSize);

    if (bias !== undefined) {
        light.shadow.bias = bias;
    }

    light.shadow.camera.near = 1;
    light.shadow.camera.far = far;
    light.shadow.camera.left = -15;
    light.shadow.camera.right = 15;
    light.shadow.camera.top = 15;
    light.shadow.camera.bottom = -15;
    light.shadow.camera.updateProjectionMatrix();
};

const DynamicLights: FC<DynamicLightsProps> = ({ preset, darkTheme }) => {
    const dirLightRef = useRef<DirectionalLight>(null);
    const isTrajectoryPreset = preset === LightingPreset.Trajectory;
    const isDefectPreset = preset === LightingPreset.Defect;

    useEffect(() => {
        const light = dirLightRef.current;
        if (!light) return;

        if (isTrajectoryPreset) {
            applyPresetShadow(light, 1024, 100);
            return;
        }

        if (isDefectPreset) {
            applyPresetShadow(light, 256, 30, -0.0001);
        }
    }, [isDefectPreset, isTrajectoryPreset]);

    if (isTrajectoryPreset) {
        return (
            <>
                <ambientLight intensity={darkTheme ? 0.8 : 0.85} />
                <directionalLight
                    ref={dirLightRef}
                    castShadow
                    position={[15, 15, 15]}
                    intensity={2.0}
                    color={KEY_LIGHT_COLOR}
                />
                <directionalLight
                    position={[-10, 10, -10]}
                    intensity={0.8}
                    color={TRAJECTORY_FILL_COLOR}
                />
                <hemisphereLight
                    groundColor={darkTheme ? '#1D1D20' : '#d1d1d6'}
                    intensity={0.5}
                />
            </>
        );
    }

    if (isDefectPreset) {
        return (
            <>
                <ambientLight intensity={darkTheme ? 0.15 : 0.22} />
                <directionalLight
                    ref={dirLightRef}
                    castShadow
                    position={[10, 15, -5]}
                    intensity={2.0}
                    color={KEY_LIGHT_COLOR}
                />
                <directionalLight
                    position={[-10, 5, 10]}
                    intensity={0.2}
                    color={DEFECT_FILL_COLOR}
                />
            </>
        );
    }

    return null;
};

export default DynamicLights;
