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
    modelRail
}) => {
    if(isLoading) return <RasterSceneSkeleton />;

    if(!scene){
        return (
            <figure className='raster-scene-container' style={{ flex: 1, minWidth: 0 }}>
                <div className='raster-scene-main'>
                    <Skeleton
                        variant='rectangular'
                        animation='wave'
                        width='100%'
                        height='100%'
                        sx={{
                            borderRadius: '0.75rem',
                            bgcolor: 'rgba(255, 255, 255, 0.06)'
                        }}
                    />
                </div>
            </figure>
        );
    }

    return (
        <figure className='raster-scene-container' style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div className='raster-scene-topbar'>
                <div className='raster-scene-topbar-center'>
                    <AnalysisSelect {...analysisSelect} />
                </div>
            </div>

            <div className='raster-scene-main'>
                {!scene.data || scene.isLoading ? (
                    <Skeleton
                        variant='rectangular'
                        animation='wave'
                        width='100%'
                        height='100%'
                        sx={{
                            borderRadius: '0.75rem',
                            bgcolor: 'rgba(255, 255, 255, 0.06)'
                        }}
                    />
                ) : disableAnimation ? (
                    <img 
                        key={`${scene.frame}-${scene.model}`}
                        className='raster-scene'
                        src={scene.data}
                        alt={`${scene.model} - Frame ${scene.frame}`}
                        style={{ objectFit: 'contain', width: '100%' }}
                    />
                ) : (
                    <AnimatePresence mode='wait'>
                        <motion.img
                            key={`${scene.frame}-${scene.model}`}
                            className="raster-scene"
                            src={scene.data}
                            alt={`${scene.model} - Frame ${scene.frame}`}
                            initial={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            style={{ objectFit: "contain", width: "100%" }}
                        />
                    </AnimatePresence>
                )}
            </div>

            <div className='raster-scene-bottombar'>
                <PlaybackControls {...playbackControls} />
            </div>

            <ModelRail {...modelRail} />
        </figure>
    );
};

export default RasterScene;