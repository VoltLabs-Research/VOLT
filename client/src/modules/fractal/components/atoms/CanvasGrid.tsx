import { Grid } from '@react-three/drei';
import { useMemo } from 'react';
import type { CanvasGridSettingsState } from '@/modules/fractal/stores/contracts/editor/visual-types';

interface CanvasGridProps {
    settings: CanvasGridSettingsState;
    darkTheme: boolean;
};

interface GridThemeDefaults {
    sectionColor: string;
    cellColor: string;
};

const DARK_GRID_DEFAULTS: GridThemeDefaults = {
    sectionColor: '#262626',
    cellColor: '#161616'
};

const LIGHT_GRID_DEFAULTS: GridThemeDefaults = {
    sectionColor: '#d1d1d6',
    cellColor: '#e5e5ea'
};

const getGridThemeDefaults = (darkTheme: boolean): GridThemeDefaults => {
    if (darkTheme) {
        return DARK_GRID_DEFAULTS;
    }

    return LIGHT_GRID_DEFAULTS;
};

const CanvasGrid = ({ settings, darkTheme }: CanvasGridProps) => {
    const themeDefaults = useMemo(() => getGridThemeDefaults(darkTheme), [darkTheme]);
    const sectionColor = useMemo(() => {
        if (settings.sectionColorFollowsTheme) {
            return themeDefaults.sectionColor;
        }

        return settings.sectionColor;
    }, [settings.sectionColor, settings.sectionColorFollowsTheme, themeDefaults.sectionColor]);
    const cellColor = useMemo(() => {
        if (settings.cellColorFollowsTheme) {
            return themeDefaults.cellColor;
        }

        return settings.cellColor;
    }, [settings.cellColor, settings.cellColorFollowsTheme, themeDefaults.cellColor]);

    if (!settings.enabled) {
        return null;
    }

    return (
        <Grid
            infiniteGrid={settings.infiniteGrid}
            cellSize={settings.cellSize}
            sectionSize={settings.sectionSize}
            cellThickness={settings.cellThickness}
            sectionThickness={settings.sectionThickness}
            fadeDistance={settings.fadeDistance}
            fadeStrength={settings.fadeStrength}
            sectionColor={sectionColor}
            cellColor={cellColor}
            position={settings.position}
            rotation={settings.rotation}
        />
    );
};

export default CanvasGrid;
