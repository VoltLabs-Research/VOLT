import React from 'react';
import type { SceneColumnProps } from '@/types/raster';
import { motion } from 'framer-motion';
import RasterResultsRenderer from '@/components/atoms/raster/RasterResultsRenderer';
import RasterScene from '../RasterScene';

const SceneColumn: React.FC<SceneColumnProps> = ({
  scene,
  dislocationData,
  isDislocationsLoading,
  activeExposures,
  availableExposures,
  isPlaying,
  isLoading,
  trajectoryId,
  playbackControls,
  analysisSelect,
  modelRail,
  configId,
  timestep,
  delay = 0,
}) => {
  const shouldShowSkeleton = isLoading && (!scene || !scene.data);

  return (
    <motion.div
      className={`raster-scene-column-  container ${scene?.model === 'dislocations' && 'theme-dark'}`}
      style={{ flex: 1, minWidth: 0 }}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {availableExposures?.map((exposure) => {
        if (!activeExposures[exposure.exposureId]) return null;

        // Render RasterResultsRenderer for any exposure with raster config
        if (exposure.raster && timestep !== undefined && configId && trajectoryId) {
          return (
            <RasterResultsRenderer
              key={exposure.exposureId}
              exposure={exposure}
              timestep={timestep}
              analysisId={configId}
              trajectoryId={trajectoryId}
            />
          );
        }

        return null;
      })}

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
