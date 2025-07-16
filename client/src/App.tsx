import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import FileManager from './components/organisms/FileManager/';
import TimestepControls from './components/organisms/TimestepControls/';
import AnalysisConfiguration from './components/organisms/AnalysisConfiguration/';
import Scene3D from './components/organisms/Scene3D/';
import TimestepViewer from './components/organisms/TimestepViewer';
import FileUpload from './components/molecules/FileUpload'; 

// import DislocationResults from './components/DislocationResults';
// import MonacoEditor from './components/organisms/MonacoEditor'; 
// import DislocationViewer from './components/DislocationViewer'; 

import './App.css';

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

const API_BASE_URL = 'http://192.168.1.85:8000/api/dislocations';

const EditorPage: React.FC = () => {
    const [folder, setFolder] = useState<any | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [currentTimestep, setCurrentTimestep] = useState<number | undefined>(undefined);
    const [cameraControlsEnabled, setCameraControlsEnabled] = useState(true);
    const [analysisConfig, setAnalysisConfig] = useState(initialAnalysisConfig);
    
    const orbitControlsRef = useRef<any>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const folderId = useMemo(() => folder?.folderId || null, [folder]);

    const timesteps = useMemo(() => {
        if (!folder?.timestepFiles) return [];
        return folder.timestepFiles
            .map((file: any) => file.timestep)
            .sort((a: number, b: number) => a - b);
    }, [folder]);

    const { currentGltfUrl, nextGltfUrl } = useMemo(() => {
        if (!folderId || currentTimestep === undefined || timesteps.length === 0) {
            return { currentGltfUrl: null, nextGltfUrl: null };
        }

        const buildUrl = (ts: number) => `${API_BASE_URL}/compressed/${folderId}/frame_${ts}_atoms.gltf`;

        const currentUrl = buildUrl(currentTimestep);

        const currentIndex = timesteps.indexOf(currentTimestep);
        let nextUrl = null;
        if (currentIndex !== -1 && timesteps.length > 1) {
            const nextIndex = (currentIndex + 1) % timesteps.length;
            const nextTimestep = timesteps[nextIndex];
            nextUrl = buildUrl(nextTimestep);
        }

        return { currentGltfUrl: currentUrl, nextGltfUrl: nextUrl };

    }, [folderId, currentTimestep, timesteps]);

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
        if(!isPlaying) {
            clearPlayTimeout();
            return;
        }

        if(!folder || timesteps.length === 0 || playSpeed <= 0){
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

    }, [isPlaying, playSpeed, folder, timesteps, currentTimestep, clearPlayTimeout]); 
    
    const handleUploadError = useCallback((error: any) => {
        console.error('Error en la subida:', error);
        alert(`Error en la subida: ${error.message || 'Error desconocido'}`);
    }, []);

    const handleFolderSelection = useCallback((folderData: any) => {
        setFolder(folderData);
        setCurrentTimestep(folderData.minTimestep);
        setIsPlaying(false);
    }, []);
    
    const handlePlayPause = useCallback(() => setIsPlaying(prev => !prev), []);
    const handleTimestepChange = useCallback((timestep: number) => setCurrentTimestep(timestep), []);

    return (
        <main className='editor-container'>
            <FileManager onFileSelect={handleFolderSelection} selectedFile={folderId} />

            {/*
            <DislocationResults ... />
            <MonacoEditor ... />
            */}

            {folder && (
                <TimestepControls
                    folderInfo={folder}
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
                </p>
            </section>

            <div className='editor-timestep-viewer-container'>
                <FileUpload 
                    onUploadError={handleUploadError} 
                    onUploadSuccess={handleFolderSelection}
                    analysisConfig={analysisConfig}
                >
                    <Scene3D
                        cameraControlsEnabled={cameraControlsEnabled}
                        onCameraControlsRef={(ref) => { orbitControlsRef.current = ref; }}
                    >
                        <TimestepViewer
                            currentGltfUrl={currentGltfUrl}
                            nextGltfUrl={nextGltfUrl}
                            scale={0.1}
                        />

                        {/* <DislocationViewer ... /> */}
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