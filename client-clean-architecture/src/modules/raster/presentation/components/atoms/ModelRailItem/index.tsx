import React from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router';
import useRasterFrame from '@/modules/raster/presentation/hooks/use-raster-frame';
import { Skeleton } from '@mui/material';
import type { Scene } from '@/types/raster';

interface ModelRailItemProps {
    scene: Scene;
    isSelected: boolean;
    onClick: (model: string) => void;
}

const ModelRailItem: React.FC<ModelRailItemProps> = ({
    scene,
    isSelected,
    onClick
}) => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { scene: loadedScene, isLoading } = useRasterFrame(
        trajectoryId,
        scene.frame,
        scene.analysisId,
        scene.model
    );

    const displayScene = loadedScene || scene;
    const hasData = (displayScene?.data !== undefined) || (scene.data !== undefined);
    const isUnavailable = displayScene?.isUnavailable;

    const showSkeleton = isLoading && !hasData;

    if(isSelected){
        return(
            <motion.div
                key={`sel-${scene.frame}-${scene.model}`}
                className='raster-analysis-scene selected'
                onClick={() => onClick(scene.model)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{
                    type: 'spring',
                    stiffness: 320,
                    damping: 26
                }}
                style={{
                    width: '100%',
                    height: 84,
                    borderRadius: '0.75rem',
                    border: '1px solid var(--accent)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    overflow: 'hidden',
                    backgroundColor: hasData ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {hasData ? (
                    <img
                        src={displayScene.data}
                        alt={`${scene.model} - Frame ${scene.frame}`}
                        title={scene.model}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                ) : isUnavailable ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        color: 'rgba(255, 255, 255, 0.4)',
                        textAlign: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '0.75rem'
                    }}>
                        Not available
                    </div>
                ) : showSkeleton ? (
                    <Skeleton
                        variant='rounded'
                        animation='wave'
                        width='100%'
                        height='100%'
                        sx={{
                            borderRadius: '0.75rem',
                            bgcolor: 'rgba(255, 255, 255, 0.12)'
                        }}
                    />
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '0.75rem'
                    }} />
                )}
            </motion.div>
        );
    }

    return(
        <motion.div
            key={`opt-${scene.frame}-${scene.model}`}
            className='raster-analysis-scene'
            onClick={() => onClick(scene.model)}
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 84, scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            style={{
                width: '100%',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                overflow: 'hidden',
                backgroundColor: hasData ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {hasData ? (
                <img
                    src={displayScene.data}
                    alt={`${scene.model} - Frame ${scene.frame}`}
                    title={scene.model}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
            ) : isUnavailable ? (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.4)',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '0.75rem'
                }}>
                    Not available
                </div>
            ) : showSkeleton ? (
                <Skeleton
                    variant='rounded'
                    animation='wave'
                    width='100%'
                    height='100%'
                    sx={{
                        borderRadius: '0.75rem',
                        bgcolor: 'rgba(255, 255, 255, 0.08)'
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: '0.75rem'
                }} />
            )}
        </motion.div>
    );
};

export default ModelRailItem;
