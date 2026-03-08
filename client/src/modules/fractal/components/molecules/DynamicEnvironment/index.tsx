import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Fog } from 'three';
import type { EnvironmentConfigState } from '@/modules/fractal/types/stores/editor/visual-types';

interface DynamicEnvironmentProps {
    settings: EnvironmentConfigState;
}

const DynamicEnvironment = ({ settings }: DynamicEnvironmentProps) => {
    const { scene, gl } = useThree();

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

    useEffect(() => {
        gl.toneMappingExposure = settings.toneMappingExposure;
    }, [gl, settings.toneMappingExposure]);

    return null;
};

export default DynamicEnvironment;
