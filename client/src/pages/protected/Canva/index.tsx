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
    const [cameraControlsEnabled, setCameraControlsEnabled] = useState(true);
    const [analysisConfig, setAnalysisConfig] = useState(initialAnalysisConfig);
    
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);
    const isLoadingTrajectory = useTrajectoryStore((state) => state.isLoading);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    
    const { trajectoryId } = useParams();
    const orbitControlsRef = useRef<any>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const timesteps = useMemo(() => {
        if (!trajectory?.frames) return [];
        return trajectory.frames
            .map((frame: any) => frame.timestep)
            .sort((a: number, b: number) => a - b);
    }, [trajectory?.frames]);

    const { currentGltfUrl, nextGltfUrl } = useMemo(() => {
        if (!trajectory?._id || currentTimestep === undefined || timesteps.length === 0) {
            return { currentGltfUrl: null, nextGltfUrl: null };
        }

        const buildUrl = (ts: number) => `/trajectories/${trajectory._id}/gltf/${ts}`;
        const currentUrl = buildUrl(currentTimestep);

        const currentIndex = timesteps.indexOf(currentTimestep);
        let nextUrl = null;
        if (currentIndex !== -1 && timesteps.length > 1) {
            const nextIndex = (currentIndex + 1) % timesteps.length;
            const nextTimestep = timesteps[nextIndex];
            nextUrl = buildUrl(nextTimestep);
        }

        console.log('URLs:', { currentUrl, nextUrl });
        return { currentGltfUrl: currentUrl, nextGltfUrl: nextUrl };
    }, [trajectory?._id, currentTimestep, timesteps]);

    const handleConfigChange = useCallback((key: string, value: any) => {
        setAnalysisConfig(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleCameraControlsEnable = useCallback((enabled: boolean) => {
        setCameraControlsEnabled(enabled);
        if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = enabled;
        }
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

        if (!trajectory || timesteps.length === 0 || playSpeed <= 0) {
            return;
        }

        const advance = () => {
            setCurrentTimestep(prevTimestep => {
                if (prevTimestep === undefined) return timesteps[0]; 
                
                const currentIndex = timesteps.indexOf(prevTimestep);
                if (currentIndex === -1) return timesteps[0]; 

                const nextIndex = (currentIndex + 1) % timesteps.length;
                return timesteps[nextIndex];
            });
        };

        timeoutRef.current = setTimeout(advance, 1000 / playSpeed);
        return clearPlayTimeout;
    }, [isPlaying, playSpeed, trajectory, timesteps, currentTimestep, clearPlayTimeout]); 
    
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
            setCurrentTimestep(trajectory.frames[0].timestep);
            setIsPlaying(false);
        }
    }, [trajectory?.frames, currentTimestep]);

    const handlePlayPause = useCallback(() => setIsPlaying(prev => !prev), []);
    const handleTimestepChange = useCallback((timestep: number) => {
        setCurrentTimestep(timestep);
        setIsPlaying(false);
    }, []);

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

            {trajectory && (
                <TimestepControls
                    folderInfo={trajectory}
                    currentTimestep={currentTimestep}
                    onTimestepChange={handleTimestepChange}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    playSpeed={playSpeed}
                    onSpeedChange={setPlaySpeed}
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
                        cameraControlsEnabled={cameraControlsEnabled}
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