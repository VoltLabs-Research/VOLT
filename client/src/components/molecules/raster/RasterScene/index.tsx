import React from 'react';
import type { RasterSceneProps } from '@/types/raster';
import RasterSceneSkeleton from '@/components/atoms/raster/RasterSceneSkeleton';
import AnalysisSelect from '@/components/atoms/raster/AnalysisSelect';
import { Skeleton } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import PlaybackControls from '@/components/atoms/raster/PlaybackControls';
import ModelRail from '@/components/atoms/raster/ModelRail';

const RasterScene: React.FC<RasterSceneProps> = ({
  scene,
  disableAnimation,
  isLoading,
  playbackControls,
  analysisSelect,
  modelRail,
}) => {
  const [showUnavailable, setShowUnavailable] = React.useState(false);
  const [showModel3D, setShowModel3D] = React.useState(false);

  React.useEffect(() => {
    setShowUnavailable(false);
  }, [scene?.frame, scene?.model, scene?.analysisId]);

  React.useEffect(() => {
    if (scene?.isUnavailable) {
      const t = setTimeout(() => setShowUnavailable(true), 800);
      return () => clearTimeout(t);
    }
    setShowUnavailable(false);
  }, [scene?.isUnavailable]);

  const handleDoubleClick = () => {
    if (scene?.analysisId) setShowModel3D(true);
  };

  if (isLoading && !scene?.data) return <RasterSceneSkeleton />;

  if (!scene?.data) {
    return (
      <figure className="raster-scene-container" style={{ flex: 1, minWidth: 0 }}>
        <div className="raster-scene-topbar">
          <div className="raster-scene-topbar-center">
            <AnalysisSelect {...analysisSelect} />
          </div>
        </div>
        <div className="raster-scene-main">
          <Skeleton
            variant="rectangular"
            animation="wave"
            width="100%"
            height="100%"
            sx={{ borderRadius: '0.75rem', bgcolor: 'rgba(255,255,255,0.06)' }}
          />
        </div>
        <div className="raster-scene-bottombar">
          <PlaybackControls {...playbackControls} />
        </div>
        <ModelRail {...modelRail} />
      </figure>
    );
  }

  const frameNumber = scene.frame ?? 'unknown';
  const modelName = scene.model ? scene.model[0].toUpperCase() + scene.model.slice(1) : 'Unknown';

  return (
    <figure className="raster-scene-container" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <div className="raster-scene-topbar">
        <div className="raster-scene-topbar-center">
          <AnalysisSelect {...analysisSelect} />
        </div>
      </div>

      <div className="raster-scene-main">
        {/*scene.data && !showModel3D && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: '0.75rem',
              zIndex: 5,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11V13C20 17.4183 16.4183 21 12 21C7.58172 21 4 17.4183 4 13V11"></path><path d="M12 3C12 3 14.121 3 16 3C17.879 3 19.501 3 20 3C21.001 3 21 4 21 4C21 4 21 7.764 21 9.5"></path><path d="M4.5 9.5C4.5 7.764 4.5 4 4.5 4C4.5 4 4.499 3 5.5 3C5.999 3 7.621 3 9.5 3C11.379 3 13.5 3 13.5 3"></path><path d="M12 12V21"></path><path d="M12 12L16 8"></path><path d="M12 12L8 8"></path></svg>
            Double-click to view in 3D
          </div>
        )*/}

        <AnimatePresence mode="wait">
          {showUnavailable ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.5)',
                textAlign: 'center',
                borderRadius: '0.75rem',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div>Model not found</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{modelName} - Frame {frameNumber}</div>
            </div>
          ) : !disableAnimation ? (
            <motion.img
              key={`2d-${scene.frame}-${scene.model}`}
              className="raster-scene"
              src={scene.data}
              alt={`${scene.model} - Frame ${scene.frame}`}
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(12px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(12px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ objectFit: 'contain', width: '100%', cursor: 'pointer' }}
              onDoubleClick={handleDoubleClick}
              title="Double-click to view in 3D"
            />
          ) : (
            <img
              key={`2d-${scene.frame}-${scene.model}`}
              className="raster-scene"
              src={scene.data}
              alt={`${scene.model} - Frame ${scene.frame}`}
              style={{ objectFit: 'contain', width: '100%', cursor: 'pointer' }}
              onDoubleClick={handleDoubleClick}
              title="Double-click to view in 3D"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="raster-scene-bottombar">
        <PlaybackControls {...playbackControls} />
      </div>

      <ModelRail {...modelRail} />
    </figure>
  );
};

export default RasterScene;
