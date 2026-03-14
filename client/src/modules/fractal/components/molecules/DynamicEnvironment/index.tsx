import { resolveEnvironmentColor, EnvironmentColorField } from '@/shared/domain/rendering/environment';
import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/ensure-monaco';
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, Fog } from 'three';

import type { EnvironmentConfigState } from '@/modules/fractal/stores/contracts/editor/visual-types';

interface DynamicEnvironmentProps {
    settings: EnvironmentConfigState;
};

const DynamicEnvironment = ({ settings }: DynamicEnvironmentProps) => {
    const { scene } = useThree();
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());

    useEffect(() => {
        return subscribeToAppTheme(setTheme);
    }, []);

    const darkTheme = theme === Theme.Dark;
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
