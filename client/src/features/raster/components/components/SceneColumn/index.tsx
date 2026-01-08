import React from 'react';
import { motion } from 'framer-motion';
import RasterScene from '@/features/raster/components/components/RasterScene';
import type { Scene, PlaybackControlsProps, AnalysisSelectProps, ModelRailProps } from '@/types/raster';

interface SceneColumnProps {
    scene: Scene | null;
    isPlaying: boolean;
    isLoading: boolean;
    playbackControls: PlaybackControlsProps;
    analysisSelect: AnalysisSelectProps;
    modelRail: ModelRailProps;
    delay?: number;
}

const SceneColumn = ({
  scene,
  isPlaying,
  isLoading,
  playbackControls,
  analysisSelect,
  modelRail,
  delay = 0,
}: SceneColumnProps) => {
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
