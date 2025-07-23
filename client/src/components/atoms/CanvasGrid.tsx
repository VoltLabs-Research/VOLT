import React from 'react';
import { Grid } from '@react-three/drei';

const CanvasGrid = () => (
    <Grid
        infiniteGrid
        cellSize={0.75}
        sectionSize={3}
        cellThickness={0.5}
        sectionThickness={1}
        fadeDistance={100}
        fadeStrength={2}
        color='#444444'
        sectionColor='#666666'
    />
);

export default CanvasGrid;