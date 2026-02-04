import React from 'react';
import { Grid } from '@react-three/drei';
import type { CanvasGridSettingsState } from '@/modules/fractal/presentation/types/stores/editor/visual-types';

interface CanvasGridProps {
    settings: CanvasGridSettingsState;
}

const CanvasGrid = ({ settings }: CanvasGridProps) => {

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
            sectionColor={settings.sectionColor}
            cellColor={settings.cellColor}
            position={settings.position}
            rotation={settings.rotation}
        />
    );
};

export default CanvasGrid;
