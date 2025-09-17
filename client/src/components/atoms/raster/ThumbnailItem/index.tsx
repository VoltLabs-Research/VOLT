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
    
    const { scene: loadedScene, isLoading: isFrameLoading } = useRasterFrame(
        trajectoryId,
        timestep,
        scene.analysisId,
        scene.model,
        isActive ? 'high' : 'low' 
    );

    const displayScene = loadedScene || scene;
    const hasData = displayScene?.data;
    const isUnavailable = displayScene?.isUnavailable;
    
    const isLoading = isActive ? false : (isFrameLoading || (scene.isLoading && !hasData));

    return (
        <motion.div
            key={`thumb-${timestep}-${scene.model}`}
            className={`raster-thumbnail-container ${isActive ? "active" : ""}`}
            animate={
                isPlaying ? {
                    scale: isActive ? 1.03 : 0.98,
                    opacity: isActive ? 1 : 0.7,
                    rotateY: isActive ? 0 : index < selectedFrameIndex ? -15 : 15
                } : {
                    scale: isActive ? 1.03 : 1,
                    opacity: 1,
                    rotateY: 0
                }
            }
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onClick(index)}
            style={{ 
                flexShrink: 0, 
                cursor: 'pointer'
            }}
        >
            <div className='raster-thumbnail-timestep-container'>
                <p className='raster-thumbnail-timestep'>{timestep}</p>
            </div>

            {hasData ? (
                <img
                    className='raster-thumbnail'
                    src={displayScene.data}
                    alt={`${displayScene.model} - Frame ${timestep}`}
                    loading={isActive ? 'eager' : 'lazy'} 
                />
            ) : isUnavailable ? (
                <div 
                    className='raster-thumbnail'
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6rem',
                        color: 'rgba(255, 255, 255, 0.4)',
                        textAlign: 'center',
                        borderRadius: '0.5rem'
                    }}
                >
                    N/A
                </div>
            ) : (
                <Skeleton
                    variant='rounded'
                    animation={isLoading ? 'wave' : false}
                    width='100%'
                    height='100%'
                    className='raster-thumbnail'
                    sx={{
                        borderRadius: '0.5rem',
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        aspectRatio: '1'
                    }}
                />
            )}
        </motion.div>
    );
};

export default React.memo(ThumbnailItem);