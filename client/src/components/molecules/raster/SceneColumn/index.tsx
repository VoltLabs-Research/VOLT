import React from 'react';
import type { SceneColumnProps } from '@/types/raster';
import { motion } from 'framer-motion';
import DislocationPanel from '@/components/atoms/raster/DislocationPanel';
import RasterScene from '../RasterScene';
import StructureAnalysisPanel from '../StructureAnalysisPanel';

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
    showStructureAnalysis,
    configId,
    timestep,
    delay = 0
}) => {
    // Solo mostrar el skeleton de carga cuando no hay escena o cuando estamos en la carga inicial
    // Si ya tenemos un scene con datos, no mostrar el skeleton aunque isLoading sea true
    const shouldShowSkeleton = isLoading && (!scene || !scene.data);
    
    return (
        <motion.div
            className='raster-scene-column-container'
            style={{ flex: 1, minWidth: 0 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
        >
            {showDislocations && (!!dislocationData || isDislocationsLoading) && (
                <DislocationPanel
                    dislocationData={dislocationData}
                    isLoading={isDislocationsLoading}
                    show={true}
                />
            )}

            {showStructureAnalysis && timestep !== undefined && configId && (
                <StructureAnalysisPanel
                    configId={configId}
                    timestep={timestep}
                    show={true}
                />
            )}

            <RasterScene
                scene={scene}
                disableAnimation={isPlaying}
                isLoading={shouldShowSkeleton}
                playbackControls={playbackControls}
                analysisSelect={analysisSelect}
                modelRail={modelRail}
            />
        </motion.div>
    );
};

export default React.memo(SceneColumn);