import { resolveEnvironmentColor, EnvironmentColorField } from '@/shared/domain/rendering/environment';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, Fog } from 'three';

import type { EnvironmentConfigState } from '@/modules/fractal/stores/contracts/editor/visual-types';

interface DynamicEnvironmentProps {
    settings: EnvironmentConfigState;
    darkTheme: boolean;
}

const DynamicEnvironment = ({ settings, darkTheme }: DynamicEnvironmentProps) => {
    const { scene } = useThree();

    const backgroundColor = resolveEnvironmentColor(
        settings.backgroundColor,
        settings.backgroundColorFollowsTheme,
        EnvironmentColorField.Background,
        darkTheme
    );
    const fogColor = resolveEnvironmentColor(
        settings.fogColor,
        settings.fogColorFollowsTheme,
        EnvironmentColorField.Fog,
        darkTheme
    );

    useEffect(() => {
        scene.background = new Color(backgroundColor);

        return () => {
            scene.background = null;
        };
    }, [backgroundColor, scene]);

    useEffect(() => {
        if (settings.enableFog) {
            scene.fog = new Fog(fogColor, settings.fogNear, settings.fogFar);
        } else {
            scene.fog = null;
        }

        return () => {
            scene.fog = null;
        };
    }, [fogColor, scene, settings.enableFog, settings.fogFar, settings.fogNear]);

    return null;
};

export default DynamicEnvironment;
