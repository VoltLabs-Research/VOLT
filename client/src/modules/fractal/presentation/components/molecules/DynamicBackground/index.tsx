import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Color } from 'three';
import type { EnvironmentConfigState } from '@/modules/fractal/presentation/types/stores/editor/visual-types';

interface DynamicBackgroundProps {
    settings: EnvironmentConfigState;
}

const DynamicBackground = ({ settings }: DynamicBackgroundProps) => {
    const { scene } = useThree();

    useEffect(() => {
        if (settings.backgroundType === 'color') {
            scene.background = new Color(settings.backgroundColor);
        } else {
            scene.background = null;
        }
    }, [scene, settings.backgroundColor, settings.backgroundType]);

    return null;
};

export default DynamicBackground;
