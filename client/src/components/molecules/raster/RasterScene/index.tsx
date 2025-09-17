import React, { useRef, useEffect } from 'react';
import type { RasterSceneProps } from '@/types/raster';
import RasterSceneSkeleton from '@/components/atoms/raster/RasterSceneSkeleton';
import AnalysisSelect from '@/components/atoms/raster/AnalysisSelect';
import { Skeleton, CircularProgress } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import PlaybackControls from '@/components/atoms/raster/PlaybackControls';
import ModelRail from '@/components/atoms/raster/ModelRail';
import Scene3D, { type Scene3DRef } from '@/components/organisms/Scene3D';
import TimestepViewer, { type TimestepViewerRef } from '@/components/organisms/TimestepViewer';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import useModelStore from '@/stores/editor/model';
import useTimestepStore from '@/stores/editor/timesteps';
import type { SceneObjectType } from '@/types/stores/editor/model';

// Extender el tipo RasterSceneProps para incluir trajectoryId
interface ExtendedRasterSceneProps extends RasterSceneProps {
    trajectoryId?: string;
}

const RasterScene: React.FC<ExtendedRasterSceneProps> = ({
    scene,
    disableAnimation,
    isLoading,
    playbackControls,
    analysisSelect,
    modelRail,
    trajectoryId
}) => {
    const [showUnavailable, setShowUnavailable] = React.useState(false);
    const [showModel3D, setShowModel3D] = React.useState(false);
    const [isModel3DLoading, setIsModel3DLoading] = React.useState(false);
    const scene3DRef = useRef<Scene3DRef>(null);
    const timestepViewerRef = useRef<TimestepViewerRef>(null);
    
    // Usar el coordinador de canvas para obtener información del trayecto y timestep actual
    const { trajectory, currentTimestep } = useCanvasCoordinator({ 
        trajectoryId: trajectoryId || '' 
    });
    
    // Debug info
    useEffect(() => {
        console.log('RasterScene - trajectoryId:', trajectoryId);
        console.log('RasterScene - trajectory loaded:', trajectory?._id);
        console.log('RasterScene - currentTimestep:', currentTimestep);
    }, [trajectoryId, trajectory, currentTimestep]);
    
    // Access to model store to set active scene when visualizing in 3D
    const setActiveScene = useModelStore((state) => state.setActiveScene);
    const isModelLoading = useModelStore((state) => state.isModelLoading);

    // Resetear estado cuando cambia la escena
    useEffect(() => {
        setShowUnavailable(false);
        // Limpiar el modelo 3D y volver a la imagen rasterizada cuando cambia el tipo o frame
        if (showModel3D) {
            setShowModel3D(false);
        }
    }, [scene?.frame, scene?.model, scene?.analysisId]);

    // Delay para mostrar "Model not found" - solo después de 1 segundo
    useEffect(() => {
        if (scene?.isUnavailable) {
            const timeout = setTimeout(() => {
                setShowUnavailable(true);
            }, 1000);
            return () => clearTimeout(timeout);
        } else {
            setShowUnavailable(false);
        }
    }, [scene?.isUnavailable, scene?.model]);

    // Actualizar el estado de carga del modelo 3D
    useEffect(() => {
        if (showModel3D) {
            setIsModel3DLoading(isModelLoading);
        }
    }, [isModelLoading, showModel3D]);

    // Set the active scene type when entering 3D mode
    useEffect(() => {
        if (showModel3D && scene?.model && trajectory?._id && currentTimestep !== undefined) {
            // Indicar que estamos cargando el modelo 3D
            setIsModel3DLoading(true);
            
            // Convert the model name to the corresponding scene type
            // This ensures we display the correct 3D visualization
            setActiveScene(scene.model as SceneObjectType);
            
            // Log para debugging
            console.log('Setting active scene:', scene.model, 'for trajectory:', trajectory._id, 'at timestep:', currentTimestep);
            
            // Importante: Asegurarse que el TimestepViewer tenga la información necesaria
            // Aquí es donde establecemos el modelo que se debe visualizar
            if (scene.analysisId) {
                const timestepStore = useTimestepStore.getState();
                // Recalcular los datos del timestep cuando se entra en modo 3D
                timestepStore.computeTimestepData(trajectory, currentTimestep);
                
                // Cargar el modelo 3D explícitamente
                if (timestepViewerRef.current) {
                    timestepViewerRef.current.loadModel();
                }
            }
        }
    }, [showModel3D, scene?.model, scene?.analysisId, setActiveScene, trajectory, currentTimestep]);

    // Handler for double-click to show 3D model
    const handleDoubleClick = () => {
        if (scene?.analysisId) {
            setShowModel3D(true);
            setIsModel3DLoading(true);
        }
    };

    // Handler for exiting 3D view
    const handleExitModel3D = () => {
        setShowModel3D(false);
        setIsModel3DLoading(false);
    };

    // Si está cargando y no hay escena, mostrar el skeleton completo
    if(isLoading && !scene?.data) {
        console.log('RasterScene - Showing skeleton due to loading state');
        return <RasterSceneSkeleton />;
    }

    if(!scene){
        console.log('RasterScene - No scene provided, showing empty skeleton');
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
                {/* Mensaje de instrucción para doble clic */}
                {scene.data && !showModel3D && (
                    <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        zIndex: 5,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 11V13C20 17.4183 16.4183 21 12 21C7.58172 21 4 17.4183 4 13V11"></path>
                            <path d="M12 3C12 3 14.121 3 16 3C17.879 3 19.501 3 20 3C21.001 3 21 4 21 4C21 4 21 7.764 21 9.5"></path>
                            <path d="M4.5 9.5C4.5 7.764 4.5 4 4.5 4C4.5 4 4.499 3 5.5 3C5.999 3 7.621 3 9.5 3C11.379 3 13.5 3 13.5 3"></path>
                            <path d="M12 12V21"></path>
                            <path d="M12 12L16 8"></path>
                            <path d="M12 12L8 8"></path>
                        </svg>
                        Double-click to view in 3D
                    </div>
                )}
                
                <AnimatePresence mode="wait">
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
                    ) : showModel3D && scene?.analysisId ? (
                        // 3D visualization container with back button
                        <>
                            {isModel3DLoading && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(13, 13, 13, 0.8)',
                                    zIndex: 10,
                                    borderRadius: '0.75rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '1rem'
                                    }}>
                                        <CircularProgress color="inherit" />
                                        <div>Cargando modelo 3D...</div>
                                    </div>
                                </div>
                            )}
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                zIndex: 20,
                                background: 'rgba(0, 0, 0, 0.7)',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }} onClick={handleExitModel3D}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18"></path>
                                    <path d="M6 6l12 12"></path>
                                </svg>
                                Volver a vista 2D
                            </div>
                            <Scene3D
                                showGizmo={false}
                                ref={scene3DRef}
                                background='#0d0d0d'
                                showCanvasGrid={false}
                                orbitControlsConfig={{
                                    enablePan: true,
                                    enableZoom: true
                                }}
                            >
                                <TimestepViewer 
                                    ref={timestepViewerRef}
                                    rotation={{}}
                                    position={{ x: 0, y: 0, z: 0 }}
                                    scale={1}
                                    autoFit={true}
                                    enableSlice={true}
                                    enableInstancing={true}
                                    updateThrottle={16}
                                    centerModelToCamera={true}
                                />
                            </Scene3D>
                        </>
                    ) : scene.data && (
                        // Si tenemos data, mostrarla inmediatamente incluso si isLoading=true o scene.isLoading=true
                        disableAnimation ? (
                            <img 
                                key={`2d-${scene.frame}-${scene.model}`}
                                className='raster-scene'
                                src={scene.data}
                                alt={`${scene.model} - Frame ${scene.frame}`}
                                style={{ objectFit: 'contain', width: '100%', cursor: 'pointer' }}
                                onDoubleClick={handleDoubleClick}
                                title="Double-click to view in 3D"
                            />
                        ) : (
                            <motion.img
                                key={`2d-${scene.frame}-${scene.model}`}
                                className="raster-scene"
                                src={scene.data}
                                alt={`${scene.model} - Frame ${scene.frame}`}
                                initial={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
                                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                style={{ objectFit: "contain", width: "100%", cursor: 'pointer' }}
                                onDoubleClick={handleDoubleClick}
                                title="Double-click to view in 3D"
                            />
                        )
                    )}
                </AnimatePresence>
                
                {!scene.data && !showUnavailable && !showModel3D && (
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
                )}
            </div>

            <div className='raster-scene-bottombar'>
                <PlaybackControls {...playbackControls} />
            </div>

            <ModelRail {...modelRail} />
        </figure>
    );
};

export default RasterScene; // End of component
