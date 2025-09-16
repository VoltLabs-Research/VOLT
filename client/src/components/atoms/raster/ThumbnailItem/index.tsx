import React from 'react';
import type { ThumbnailItemProps } from '@/types/raster';
import { motion } from 'framer-motion';

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
    scene,
    timestep,
    index,
    isActive,
    isPlaying,
    selectedFrameIndex,
    onClick
}) => {
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

            <img
                className='raster-thumbnail'
                src={scene.data}
                alt={`${scene.model} - Frame ${timestep}`}
                loading='lazy'
            />
        </motion.div>
    );
};

export default ThumbnailItem;