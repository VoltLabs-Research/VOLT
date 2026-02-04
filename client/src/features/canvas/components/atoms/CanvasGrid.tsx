import React from 'react';
import { Grid } from '@react-three/drei';
import { useEditorStore } from '@/features/canvas/stores/editor';

const CanvasGrid = () => {
    const settings = useEditorStore((state) => state.grid);

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
