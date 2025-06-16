import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Environment } from '@react-three/drei';
import { IoAddOutline } from 'react-icons/io5';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import TimestepViewer from './components/TimestepViewer';
import DislocationViewer from './components/DislocationViewer';
import TimestepControls from './components/TimestepControls';
import useTimestepStream from './hooks/useTimestepStream';
import useAnalysisStream from './hooks/useAnalysisStream';
import './App.css';

const CanvasGrid = () => {
    const { gl } = useThree();

    useEffect(() => {
        gl.setClearColor('#1a1a1a');
    }, [gl]);

    return (
        <Grid
            infiniteGrid
            cellSize={0.75}
            sectionSize={3}
            cellThickness={0.5}
            sectionThickness={1}
            fadeDistance={100}
            fadeStrength={2}
            color='#333333'
            sectionColor='#555555'
        />
    );
};

const MemoizedCanvasGrid = React.memo(CanvasGrid);

const App = () => {
    const [folder, setFolder] = useState<object | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [currentTimestep, setCurrentTimestep] = useState(0);
    const [cameraControlsEnabled, setCameraControlsEnabled] = useState(true);
    const orbitControlsRef = useRef<any>(null);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentIndexRef = useRef(0);

    const folderId = useMemo(() => folder?.folder_id || null, [folder?.folder_id]);
    
    const { data, error } = useTimestepStream({ 
        folderId, 
        timestepId: currentTimestep 
    });

    const handleCameraControlsEnable = useCallback((enabled: boolean) => {
        setCameraControlsEnabled(enabled);
        if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = enabled;
        }
    }, []);
    
    const analysisStream = useAnalysisStream({
        folderId: folderId ?? '',
        timestep: currentTimestep,
    });

    const timesteps = useMemo(() => folder?.timesteps || [], [folder?.timesteps]);
    
    const { minTimestep, maxTimestep } = useMemo(() => ({
        minTimestep: folder?.min_timestep || 0,
        maxTimestep: folder?.max_timestep || 1
    }), [folder?.min_timestep, folder?.max_timestep]);

    const clearPlayTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        clearPlayTimeout();
        
        if (!folder || !isPlaying || timesteps.length === 0 || playSpeed <= 0) {
            return;
        }

        const advance = () => {
            setCurrentTimestep(prevTimestep => {
                const currentIndex = timesteps.indexOf(prevTimestep);
                const nextIndex = (currentIndex + 1) % timesteps.length;
                currentIndexRef.current = nextIndex;
                return timesteps[nextIndex];
            });
        };

        timeoutRef.current = setTimeout(advance, 1000 / playSpeed);

        return clearPlayTimeout;
    }, [isPlaying, playSpeed, folder, timesteps, clearPlayTimeout, currentTimestep]);

    useEffect(() => {
        if (!folder || !timesteps.length) return;
        
        const index = timesteps.indexOf(currentTimestep);
        if (index >= 0) {
            currentIndexRef.current = index;
        }
    }, [currentTimestep, folder, timesteps]);

    const handleUploadError = useCallback((error: string) => {
        console.error('OpenDXA: Upload error:', error);
    }, []);

    const handleFolderSelection = useCallback((folder_data) => {
        setFolder(folder_data);
        setCurrentTimestep(folder_data.min_timestep || 0);
    }, []);

    const handlePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const handleTimestepChange = useCallback((timestep: number) => {
        setCurrentTimestep(timestep);
    }, []);

    const streamProgress = useMemo(() => ({
        current: currentTimestep,
        total: maxTimestep
    }), [currentTimestep, maxTimestep]);

    const cameraConfig = useMemo(() => ({
        position: [12, 8, 12] as [number, number, number],
        fov: 50
    }), []);

    const lightConfig = useMemo(() => ({
        ambient: { intensity: 0.4 },
        directional: {
            position: [15, 15, 15] as [number, number, number],
            intensity: 1.0,
            'shadow-mapSize': [2048, 2048] as [number, number],
            'shadow-camera-far': 100,
            'shadow-camera-left': -15,
            'shadow-camera-right': 15,
            'shadow-camera-top': 15,
            'shadow-camera-bottom': -15
        }
    }), []);

    const orbitControlsConfig = useMemo(() => ({
        makeDefault: true,
        enableDamping: true,
        dampingFactor: 0.05,
        rotateSpeed: 0.7,
        maxDistance: 30,
        minDistance: 2,
        target: [0, 3, 0] as [number, number, number]
    }), []);

    return (
        <main className='editor-container'>
            <FileList onFileSelect={handleFolderSelection} />

            {folder && (
                <TimestepControls
                    folderInfo={folder}
                    currentTimestep={currentTimestep}
                    onTimestepChange={handleTimestepChange}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    playSpeed={playSpeed}
                    onSpeedChange={setPlaySpeed}
                    isConnected={!!data}
                    isStreaming={isPlaying}
                    streamProgress={streamProgress}
                />
            )}

            <section className='editor-camera-info-container'>
                <h3 className='editor-camera-info-title'>Perspective Camera</h3>
                <p className='editor-camera-info-description'>
                    Timestep Visualization 
                </p>
            </section>

            <div className='editor-timestep-viewer-container'>
                <FileUpload onUploadError={handleUploadError} onUploadSuccess={handleFolderSelection}>
                    <Canvas shadows camera={cameraConfig}>
                        <ambientLight intensity={lightConfig.ambient.intensity} />
                        <directionalLight
                            castShadow
                            position={lightConfig.directional.position}
                            intensity={lightConfig.directional.intensity}
                            shadow-mapSize={lightConfig.directional['shadow-mapSize']}
                            shadow-camera-far={lightConfig.directional['shadow-camera-far']}
                            shadow-camera-left={lightConfig.directional['shadow-camera-left']}
                            shadow-camera-right={lightConfig.directional['shadow-camera-right']}
                            shadow-camera-top={lightConfig.directional['shadow-camera-top']}
                            shadow-camera-bottom={lightConfig.directional['shadow-camera-bottom']}
                        />
                        
                        <MemoizedCanvasGrid />
                        
                        <OrbitControls 
                            ref={orbitControlsRef}
                            {...orbitControlsConfig}
                            enabled={cameraControlsEnabled}
                        />
                                                
                        <Environment preset='city' />

                        {folder && data && (
                            <TimestepViewer
                                data={data}
                                onCameraControlsEnable={handleCameraControlsEnable}
                            />
                        )}

                        {analysisStream.data && (
                            <DislocationViewer
                                segments={analysisStream.data}
                                scale={0.2}
                                centerOffset={[-5, 0, 10]}
                            />
                        )}
                    </Canvas>
                </FileUpload>
            </div>

            <section className='editor-dislocations-button-container'>
                <IoAddOutline className='editor-dislocations-button-icon' />
                <span className='editor-dislocations-button-text'>
                    Dislocation Analysis
                </span>
            </section>
        </main>
    );
};

export default App;