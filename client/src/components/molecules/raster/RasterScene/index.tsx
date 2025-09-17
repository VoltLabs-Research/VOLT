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
    const [showUnavailable, setShowUnavailable] = React.useState(false);

    // Resetear estado cuando cambia la escena
    React.useEffect(() => {
        setShowUnavailable(false);
    }, [scene?.frame, scene?.model, scene?.analysisId]);

    // Delay para mostrar "Model not found" - solo después de 1 segundo
    React.useEffect(() => {
        if (scene?.isUnavailable) {
            const timeout = setTimeout(() => {
                setShowUnavailable(true);
            }, 1000);
            return () => clearTimeout(timeout);
        } else {
            setShowUnavailable(false);
        }
    }, [scene?.isUnavailable, scene?.model]);

    // Si está cargando y no hay escena, mostrar el skeleton completo
    if(isLoading && !scene?.data) return <RasterSceneSkeleton />;

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

    // Ensure we have a valid frame number to display
    const frameNumber = scene.frame !== undefined && scene.frame !== null ? scene.frame : 'unknown';
    const modelName = scene.model ? (scene.model.slice(0, 1).toUpperCase() + scene.model.slice(1)) : 'Unknown';

    return (
        <figure className='raster-scene-container' style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div className='raster-scene-topbar'>
                <div className='raster-scene-topbar-center'>
                    <AnalysisSelect {...analysisSelect} />
                </div>
            </div>

            <div className='raster-scene-main'>
                {showUnavailable ? (
                    <div style={{
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
                        gap: '0.5rem'
                    }}>
                        <div>Model not found</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                            {modelName} - Frame {frameNumber}
                        </div>
                    </div>
                ) : (
                    // Si tenemos data, mostrarla inmediatamente incluso si isLoading=true o scene.isLoading=true
                    scene.data ? (
                        disableAnimation ? (
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
                        )
                    ) : (
                        // Solo mostrar skeleton si no tenemos datos
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
                    )
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