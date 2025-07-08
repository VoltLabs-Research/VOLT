import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import FileManager from './components/organisms/FileManager/';
import TimestepControls from './components/organisms/TimestepControls/';
import AnalysisConfiguration from './components/organisms/AnalysisConfiguration/';
import Scene3D from './components/organisms/Scene3D/';
import TimestepViewer from './components/TimestepViewer';
import DislocationViewer from './components/DislocationViewer';
import FileUpload from './components/FileUpload';
import DislocationResults from './components/DislocationResults';
import useTimestepDataManager from './hooks/useTimestepDataManager';
import MonacoEditor from './components/organisms/MonacoEditor';
import type { DislocationSegment } from './hooks/useTimestepDataManager';
import './App.css';

const EditorPage: React.FC = () => {
    const [folder, setFolder] = useState<any | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [currentTimestep, setCurrentTimestep] = useState(0);
    const [cameraControlsEnabled, setCameraControlsEnabled] = useState(true);
    const [selectedDislocation, setSelectedDislocation] = useState<DislocationSegment | null>(null);

    const orbitControlsRef = useRef<any>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const folderId = useMemo(() => folder?.folder_id || null, [folder]);
    const timesteps = useMemo(() => folder?.timesteps || [], [folder]);
    
    const { data, isLoading } = useTimestepDataManager({ 
        folderId, 
        currentTimestep,
        timesteps
    });

    const handleCameraControlsEnable = useCallback((enabled: boolean) => {
        setCameraControlsEnabled(enabled);
        if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = enabled;
        }
    }, []);
    
    const { maxTimestep } = useMemo(() => ({
        maxTimestep: folder?.max_timestep || 1
    }), [folder]);

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
                return timesteps[nextIndex];
            });
        };

        if (!isLoading) {
            timeoutRef.current = setTimeout(advance, 1000 / playSpeed);
        }

        return clearPlayTimeout;
    }, [isPlaying, playSpeed, folder, timesteps, clearPlayTimeout, currentTimestep, isLoading]);

    const handleUploadError = useCallback((error: string) => {
        console.error('OpenDXA: Upload error:', error);
    }, []);

    const handleFolderSelection = useCallback((folder_data: any) => {
        setFolder(folder_data);
        setCurrentTimestep(folder_data.min_timestep || 0);
        setIsPlaying(false);
        setSelectedDislocation(null);
    }, []);

    const handlePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const handleTimestepChange = useCallback((timestep: number) => {
        setCurrentTimestep(timestep);
    }, []);

    const handleDislocationSelect = useCallback((segment: DislocationSegment) => {
        setSelectedDislocation(segment);
    }, []);

    useEffect(() => {
        console.log(data)
    }, [data]);

    const streamProgress = useMemo(() => ({
        current: currentTimestep,
        total: maxTimestep
    }), [currentTimestep, maxTimestep]);

    return (
        <main className='editor-container'>
            <FileManager onFileSelect={handleFolderSelection} selectedFile={folder?.folder_id || null} />
            
            {data?.dislocation_results && Object.keys(data.dislocation_results).length > 0 && (
                <DislocationResults 
                    results={data.dislocation_results}
                    segments={data.dislocation_data}
                    timestep={data.atoms_data.timestep}
                    onDislocationSelect={handleDislocationSelect}
                />
            )}

            <MonacoEditor 
                folderId={folderId}
                currentTimestamp={currentTimestep}
            />

            {folder && (
                <TimestepControls
                    folderInfo={folder}
                    currentTimestep={currentTimestep}
                    onTimestepChange={handleTimestepChange}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    playSpeed={playSpeed}
                    onSpeedChange={setPlaySpeed}
                    isConnected={!isLoading && !!data}
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
                        {data?.atoms_data && (
                            <TimestepViewer
                                key={folderId}
                                data={data.atoms_data}
                                onCameraControlsEnable={handleCameraControlsEnable}
                            />
                        )}

                        {data?.dislocation_data && data.dislocation_data.length > 0 && (
                            <DislocationViewer
                                segments={data.dislocation_data}
                                scale={0.2}
                                centerOffset={[-5, 0, 10]}
                                selectedDislocationId={selectedDislocation?.id}
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