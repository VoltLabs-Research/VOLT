import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import FileManager from './components/organisms/FileManager/';
import TimestepControls from './components/organisms/TimestepControls/';
import AnalysisConfiguration from './components/organisms/AnalysisConfiguration/';
import Scene3D from './components/organisms/Scene3D/';
import TimestepViewer from './components/TimestepViewer';
import DislocationViewer from './components/DislocationViewer';
import FileUpload from './components/FileUpload';
import useTimestepStream from './hooks/useTimestepStream';
import useAnalysisStream from './hooks/useAnalysisStream';
import './App.css';

const EditorPage: React.FC = () => {
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

    return (
        <main className='editor-container'>
            <FileManager onFileSelect={handleFolderSelection} selectedFile={folder?.folder_id || null} />

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
                    <Scene3D
                        cameraControlsEnabled={cameraControlsEnabled}
                        onCameraControlsRef={(ref) => { orbitControlsRef.current = ref; }}
                    >
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
                                onCameraControlsEnable={handleCameraControlsEnable}
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

            <AnalysisConfiguration />
        </main>
    );
};

export default EditorPage;