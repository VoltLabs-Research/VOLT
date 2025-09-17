import React from 'react';
import type { ThumbnailItemProps } from '@/types/raster';
import { motion } from 'framer-motion';
import useRasterFrame from '@/hooks/raster/use-raster-frame';
import { useParams } from 'react-router';
import { Skeleton } from '@mui/material';

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
    scene,
    timestep,
    index,
    isActive,
    isPlaying,
    selectedFrameIndex,
    onClick
}) => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { scene: loadedScene } = useRasterFrame(
        trajectoryId,
        timestep,
        scene.analysisId,
        scene.model
    );

    const displayScene = loadedScene || scene;
    const hasData = displayScene?.data && !displayScene.isLoading;

    return (
        <motion.div
            key={`thumb-${timestep}-${scene.model}`}
            className={`raster-thumbnail-container ${isActive ? "active" : ""}`}
            animate={
                isPlaying ? {
                    scale: isActive ? 1 : 0.98,
                    opacity: isActive ? 1 : 0.5,
                    rotateY: isActive ? 0 : index < selectedFrameIndex ? -20 : 20
                } : {
                    scale: 1,
                    opacity: 1,
                    rotateY: 0
                }
            }
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onClick(index)}
            style={{ flexShrink: 0, cursor: 'pointer' }}
        >
            <div className='raster-thumbnail-timestep-container'>
                <p className='raster-thumbnail-timestep'>{timestep}</p>
            </div>

            {hasData ? (
                <img
                    className='raster-thumbnail'
                    src={displayScene.data}
                    alt={`${displayScene.model} - Frame ${timestep}`}
                    loading='lazy'
                />
            ) : (
                <Skeleton
                    variant='rounded'
                    animation='wave'
                    width='100%'
                    height='100%'
                    className='raster-thumbnail'
                    sx={{
                        borderRadius: '0.5rem',
                        bgcolor: 'rgba(255, 255, 255, 0.06)',
                        aspectRatio: '1'
                    }}
                />
            )}
        </motion.div>
    );
};

export default ThumbnailItem;