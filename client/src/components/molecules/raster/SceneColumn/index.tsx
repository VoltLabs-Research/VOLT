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
  trajectoryId,
  playbackControls,
  analysisSelect,
  modelRail,
  showStructureAnalysis,
  configId,
  timestep,
  delay = 0,
}) => {
  const shouldShowSkeleton = isLoading && (!scene || !scene.data);

  return (
    <motion.div
      className={`raster-scene-column-container ${scene?.model === 'dislocations' && 'theme-dark'}`}
      style={{ flex: 1, minWidth: 0 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {showDislocations && (!!dislocationData || isDislocationsLoading) && (
        <DislocationPanel dislocationData={dislocationData} isLoading={isDislocationsLoading} show />
      )}

      {showStructureAnalysis && timestep !== undefined && configId && (
        <StructureAnalysisPanel configId={configId} timestep={timestep} show />
      )}

      <RasterScene
        scene={scene}
        trajectoryId={trajectoryId}
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
