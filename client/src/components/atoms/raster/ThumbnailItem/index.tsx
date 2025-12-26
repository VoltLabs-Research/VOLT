import React from 'react';
import type { ThumbnailItemProps } from '@/types/raster';
import { motion } from 'framer-motion';
import useRasterFrame from '@/hooks/raster/use-raster-frame';
import { useParams } from 'react-router';
import { Skeleton } from '@mui/material';
import Paragraph from '@/components/primitives/Paragraph';

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
  scene,
  timestep,
  index,
  isActive,
  isPlaying,
  selectedFrameIndex,
  onClick,
}) => {
  const { trajectoryId } = useParams<{ trajectoryId: string }>();

  // Accepts a 5th priority arg; our hook signature now tolerates it
  const { scene: loadedScene, isLoading: loadingFrame } = useRasterFrame(
    trajectoryId,
    timestep,
    scene.analysisId,
    scene.model,
    isActive ? 'high' : 'low'
  );

  const display = loadedScene || scene;
  const hasData = !!display?.data;
  const isUnavailable = display?.isUnavailable;
  const isLoading = isActive ? false : (loadingFrame || (scene.isLoading && !hasData));

  return (
    <motion.div
      key={`thumb - ${timestep} -${scene.model} `}
      className={`raster-thumbnail-container ${isActive ? 'active' : ''} `}
      animate={
        isPlaying
          ? {
            scale: isActive ? 1.03 : 0.98,
            opacity: isActive ? 1 : 0.7,
            rotateY: isActive ? 0 : index < selectedFrameIndex ? -15 : 15,
          }
          : { scale: isActive ? 1.03 : 1, opacity: 1, rotateY: 0 }
      }
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onClick(index)}
      style={{ flexShrink: 0, cursor: 'pointer' }}
    >
      <div className="raster-thumbnail-timestep-container p-absolute">
        <Paragraph className="raster-thumbnail-timestep color-primary">{timestep}</Paragraph>
      </div>

      {hasData ? (
        <img className="raster-thumbnail" src={display!.data!} alt={`${display!.model} - Frame ${timestep} `} loading={isActive ? 'eager' : 'lazy'} />
      ) : isUnavailable ? (
        <div
          className="raster-thumbnail"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6rem',
            color: 'rgba(255, 255, 255, 0.4)',
            textAlign: 'center',
            borderRadius: '0.5rem',
          }}
        >
          N/A
        </div>
      ) : (
        <Skeleton
          variant="rounded"
          animation={isLoading ? 'wave' : false}
          width="100%"
          height="100%"
          className="raster-thumbnail"
          sx={{ borderRadius: '0.5rem', bgcolor: 'rgba(255, 255, 255, 0.05)', aspectRatio: '1' }}
        />
      )}
    </motion.div>
  );
};

export default React.memo(ThumbnailItem);
