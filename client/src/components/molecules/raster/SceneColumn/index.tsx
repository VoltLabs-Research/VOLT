import React from 'react';
import type { SceneColumnProps } from '@/types/raster';
import { motion } from 'framer-motion';
import DislocationPanel from '@/components/atoms/raster/DislocationPanel';
import RasterScene from '../RasterScene';

const SceneColumn: React.FC<SceneColumnProps> = ({
    scene,
    dislocationData,
    isDislocationsLoading,
    showDislocations,
    isPlaying,
    isLoading,
    playbackControls,
    analysisSelect,
    modelRail,
    delay = 0
}) => {
    return (
        <motion.div
            className='raster-scene-column-container'
            style={{ flex: 1, minWidth: 0 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
        >
            <DislocationPanel
                dislocationData={dislocationData}
                isLoading={isDislocationsLoading}
                show={showDislocations && (!!dislocationData || isDislocationsLoading)}
            />

            <RasterScene
                scene={scene}
                disableAnimation={isPlaying}
                isLoading={isLoading}
                playbackControls={playbackControls}
                analysisSelect={analysisSelect}
                modelRail={modelRail}
            />
        </motion.div>
    );
};

export default SceneColumn;