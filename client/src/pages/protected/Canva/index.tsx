import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import { useParams } from 'react-router-dom';
import TrajectoryList from '../../../components/organisms/TrajectoryList';
import TimestepControls from '../../../components/organisms/TimestepControls';
import AnalysisConfiguration from '../../../components/organisms/AnalysisConfiguration';
import Scene3D from '../../../components/organisms/Scene3D';
import TimestepViewer from '../../../components/organisms/TimestepViewer';
import FileUpload from '../../../components/molecules/FileUpload'; 
import useTrajectoryStore from '../../../stores/trajectories';
import Loader from '../../../components/atoms/Loader';
import './Canva.css';

const initialAnalysisConfig = {
    crystal_structure: 'FCC',
    identification_mode: 'PTM',
    max_trial_circuit_size: 14.0,
    circuit_stretchability: 9.0,
    defect_mesh_smoothing_level: 8,
    line_smoothing_level: 1.0,
    line_point_interval: 2.5,
    only_perfect_dislocations: false,
    mark_core_atoms: false
};

const EditorPage: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [currentTimestep, setCurrentTimestep] = useState<number | undefined>(undefined);
    const [analysisConfig, setAnalysisConfig] = useState(initialAnalysisConfig);
    
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);
    const isLoadingTrajectory = useTrajectoryStore((state) => state.isLoading);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    
    const { trajectoryId } = useParams();
    const orbitControlsRef = useRef<any>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const timestepData = useMemo(() => {
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            return {
                timesteps: [],
                minTimestep: 0,
                maxTimestep: 0,
                timestepCount: 0
            };
        }

        const timesteps = trajectory.frames
            .map((frame: any) => frame.timestep)
            .sort((a: number, b: number) => a - b);

        return {
            timesteps,
            minTimestep: timesteps[0] || 0,
            maxTimestep: timesteps[timesteps.length - 1] || 0,
            timestepCount: timesteps.length
        };
    }, [trajectory?.frames]);

    const folderInfo = useMemo(() => {
        if (!trajectory) {
            return {
                folderId: '',
                timesteps: 0,
                minTimestep: 0,
                maxTimestep: 0,
                availableTimesteps: []
            };
        }

        return {
            folderId: trajectory.folderId || trajectory._id,
            timesteps: timestepData.timestepCount,
            minTimestep: timestepData.minTimestep,
            maxTimestep: timestepData.maxTimestep,
            availableTimesteps: timestepData.timesteps
        };
    }, [trajectory, timestepData]);

    const { currentGltfUrl, nextGltfUrl } = useMemo(() => {
        if (!trajectory?._id || currentTimestep === undefined || timestepData.timesteps.length === 0) {
            return { currentGltfUrl: null, nextGltfUrl: null };
        }

        const buildUrl = (ts: number) => `/trajectories/${trajectory._id}/gltf/${ts}`;
        const currentUrl = buildUrl(currentTimestep);

        const currentIndex = timestepData.timesteps.indexOf(currentTimestep);
        let nextUrl = null;
        if (currentIndex !== -1 && timestepData.timesteps.length > 1) {
            const nextIndex = (currentIndex + 1) % timestepData.timesteps.length;
            const nextTimestep = timestepData.timesteps[nextIndex];
            nextUrl = buildUrl(nextTimestep);
        }

        console.log('URLs:', { currentUrl, nextUrl });
        return { currentGltfUrl: currentUrl, nextGltfUrl: nextUrl };
    }, [trajectory?._id, currentTimestep, timestepData.timesteps]);

    const handleConfigChange = useCallback((key: string, value: any) => {
        setAnalysisConfig(prev => ({ ...prev, [key]: value }));
    }, []);

    const clearPlayTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!isPlaying) {
            clearPlayTimeout();
            return;
        }

        if (!trajectory || timestepData.timesteps.length === 0 || playSpeed <= 0) {
            return;
        }

        const advance = () => {
            setCurrentTimestep(prevTimestep => {
                if (prevTimestep === undefined) return timestepData.timesteps[0]; 
                
                const currentIndex = timestepData.timesteps.indexOf(prevTimestep);
                if (currentIndex === -1) return timestepData.timesteps[0]; 

                const nextIndex = (currentIndex + 1) % timestepData.timesteps.length;
                return timestepData.timesteps[nextIndex];
            });
        };

        timeoutRef.current = setTimeout(advance, 1000 / playSpeed);
        return clearPlayTimeout;
    }, [isPlaying, playSpeed, trajectory, timestepData.timesteps, currentTimestep, clearPlayTimeout]); 
    
    const handleUploadError = useCallback((error: any) => {
        console.error('Error en la subida:', error);
        alert(`Error en la subida: ${error.message || 'Error desconocido'}`);
    }, []);

    const handleTrajectorySelection = useCallback((trajectoryData: any) => {
        if (trajectoryData?.frames?.length > 0) {
            setCurrentTimestep(trajectoryData.frames[0].timestep);
            setIsPlaying(false);
        }
    }, []);

    useEffect(() => {
        if (trajectoryId && !trajectory?._id) {
            getTrajectoryById(trajectoryId);
        }
    }, [trajectoryId, trajectory?._id, getTrajectoryById]);

    useEffect(() => {
        if (trajectory?.frames?.length > 0 && currentTimestep === undefined) {
            const firstTimestep = timestepData.timesteps[0];
            if (firstTimestep !== undefined && !isNaN(firstTimestep)) {
                setCurrentTimestep(firstTimestep);
                setIsPlaying(false);
            }
        }
    }, [trajectory?.frames, currentTimestep, timestepData.timesteps]);

    const handlePlayPause = useCallback(() => setIsPlaying(prev => !prev), []);
    
    const handleTimestepChange = useCallback((timestep: number) => {
        if (!isNaN(timestep) && timestepData.timesteps.includes(timestep)) {
            setCurrentTimestep(timestep);
            setIsPlaying(false);
        }
    }, [timestepData.timesteps]);

    const shouldRenderControls = trajectory && 
                                 timestepData.timesteps.length > 0 && 
                                 !isNaN(folderInfo.minTimestep) && 
                                 !isNaN(folderInfo.maxTimestep) &&
                                 currentTimestep !== undefined &&
                                 !isNaN(currentTimestep);

    return (
        <main className='editor-container'>
            <TrajectoryList 
                onFileSelect={handleTrajectorySelection} 
                selectedFile={trajectory?._id} 
            />
            
            {isLoadingTrajectory && (
                <div className='loader-layer-container'>
                    <Loader scale={0.7} />
                </div>
            )}

            {shouldRenderControls && (
                <TimestepControls
                    folderInfo={folderInfo}
                    currentTimestep={currentTimestep!}
                    onTimestepChange={handleTimestepChange}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    playSpeed={playSpeed}
                    onSpeedChange={setPlaySpeed}
                    isConnected={true}
                    isStreaming={false}
                    streamProgress={{ current: 0, total: 0 }}
                />
            )}

            <section className='editor-camera-info-container'>
                <h3 className='editor-camera-info-title'>Perspective Camera</h3>
                <p className='editor-camera-info-description'>
                    Visualización del Timestep {currentTimestep ?? ''}
                    {trajectory && ` - ${trajectory.name}`}
                </p>
            </section>

            <div className='editor-timestep-viewer-container'>
                <FileUpload 
                    onUploadError={handleUploadError} 
                    onUploadSuccess={handleTrajectorySelection}
                    analysisConfig={analysisConfig}
                >
                    <Scene3D
                        onCameraControlsRef={(ref) => { orbitControlsRef.current = ref; }}
                    >
                        {currentGltfUrl && (
                            <TimestepViewer
                                currentGltfUrl={currentGltfUrl}
                                nextGltfUrl={nextGltfUrl}
                                scale={0.1}
                            />
                        )}
                    </Scene3D>
                </FileUpload>
            </div>

            <section className='editor-dislocations-button-container'>
                <IoAddOutline className='editor-dislocations-button-icon' />
                <span className='editor-dislocations-button-text'>
                    Dislocation Analysis
                </span>
            </section>

            <AnalysisConfiguration 
                config={analysisConfig} 
                onConfigChange={handleConfigChange} 
            />
        </main>
    );
};

export default EditorPage;