import { Environment, Lightformer } from '@react-three/drei';
import { useMemo } from 'react';
import { Euler } from 'three';

import type { LightsGlobal } from '@/shared/rendering/lights';

interface DynamicEnvironmentMapProps {
    settings: LightsGlobal;
    darkTheme: boolean;
}

const ENVIRONMENT_RESOLUTION = 64;

const DynamicEnvironmentMap = ({ settings, darkTheme }: DynamicEnvironmentMapProps) => {
    const environmentRotation = useMemo(
        () => new Euler(settings.envRotationPitch, settings.envRotationYaw, 0),
        [settings.envRotationPitch, settings.envRotationYaw]
    );

    const panelColor = darkTheme ? '#ffffff' : '#f5f5f7';

    return (
        <Environment
            frames={1}
            resolution={ENVIRONMENT_RESOLUTION}
            environmentIntensity={settings.envIntensity}
            environmentRotation={environmentRotation}
        >
            <Lightformer
                form='rect'
                intensity={1.6}
                color={panelColor}
                position={[0, 5, 0]}
                rotation-x={Math.PI / 2}
                scale={[10, 10, 1]}
            />
            <Lightformer
                form='rect'
                intensity={0.8}
                color={panelColor}
                position={[-5, 1, -1]}
                rotation-y={Math.PI / 2}
                scale={[6, 3, 1]}
            />
            <Lightformer
                form='rect'
                intensity={0.8}
                color={panelColor}
                position={[5, 1, 1]}
                rotation-y={-Math.PI / 2}
                scale={[6, 3, 1]}
            />
            <Lightformer
                form='rect'
                intensity={0.4}
                color={panelColor}
                position={[0, -4, 0]}
                rotation-x={-Math.PI / 2}
                scale={[8, 8, 1]}
            />
        </Environment>
    );
};

export default DynamicEnvironmentMap;
