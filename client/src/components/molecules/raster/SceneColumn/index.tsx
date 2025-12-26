import React from 'react';
import type { SceneColumnProps } from '@/types/raster';
import { motion } from 'framer-motion';
import RasterScene from '../RasterScene';

const SceneColumn: React.FC<SceneColumnProps> = ({
  scene,
  isPlaying,
  isLoading,
  trajectoryId,
  playbackControls,
  analysisSelect,
  modelRail,
  delay = 0,
}) => {
  const shouldShowSkeleton = isLoading && (!scene || !scene.data);

  return (
    <motion.div
      className={`raster-scene-column-container ${scene?.model === 'dislocations' && 'theme-dark'}`}
      style={{ flex: 1, minWidth: 0 }}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
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
