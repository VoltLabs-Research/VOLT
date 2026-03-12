import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, Fog } from 'three';

import type { EnvironmentConfigState } from '@/modules/fractal/stores/contracts/editor/visual-types';

interface DynamicEnvironmentProps {
    settings: EnvironmentConfigState;
};

const DynamicEnvironment = ({ settings }: DynamicEnvironmentProps) => {
    const { scene } = useThree();

    useEffect(() => {
        scene.background = new Color(settings.backgroundColor);

        return () => {
            scene.background = null;
        };
    }, [scene, settings.backgroundColor]);

    useEffect(() => {
        if (settings.enableFog) {
            scene.fog = new Fog(settings.fogColor, settings.fogNear, settings.fogFar);
        } else {
            scene.fog = null;
        }

        return () => {
            scene.fog = null;
        };
    }, [scene, settings.enableFog, settings.fogColor, settings.fogNear, settings.fogFar]);

    return null;
};

export default DynamicEnvironment;
