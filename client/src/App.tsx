import React, { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Environment } from '@react-three/drei';
import { IoAddOutline } from 'react-icons/io5';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import TimestepViewer from './components/TimestepViewer';
import TimestepControls from './components/TimestepControls';
import useTimestepManager from './hooks/useTimestepManager';
import AnalysisConfig from './components/AnalysisConfig';
import type { FileInfo } from './types/index';
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

const App = () => {
    const [selectedFile, setSelectedFile] = useState<FileInfo | undefined>();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    const {
        timesteps,
        currentTimestep,
        isPlaying,
        playSpeed,
        handleTimestepChange,
        handlePlayPause,
        handleSpeedChange
    } = useTimestepManager(selectedFile || null);

    const handleUploadError = (error: string) => {
        console.error('Upload error:', error);
    };

    const handleUploadSuccess = () => {
        console.log('Upload success');
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <main className='editor-container'>
            <FileList
                onFileSelect={(file) => {
                    console.log('File selected:', file);
                    setSelectedFile(file);
                }}
                selectedFile={selectedFile}
                refreshTrigger={refreshTrigger}
            />

            <AnalysisConfig />

            <section className='editor-camera-info-container'>
                <h3 className='editor-camera-info-title'>Perspective Camera</h3>
                <p className='editor-camera-info-description'>Timestep Visualization</p>
            </section>

            <div className='editor-timestep-viewer-container'>
                <FileUpload onUploadError={handleUploadError} onUploadSuccess={handleUploadSuccess}>
                    <Canvas shadows camera={{ position: [12, 8, 12], fov: 50 }}>
                        <ambientLight intensity={0.4} />
                        <directionalLight
                            castShadow
                            position={[15, 15, 15]}
                            intensity={1.0}
                            shadow-mapSize-width={2048}
                            shadow-mapSize-height={2048}
                            shadow-camera-far={100}
                            shadow-camera-left={-15}
                            shadow-camera-right={15}
                            shadow-camera-top={15}
                            shadow-camera-bottom={-15}
                        />
                        <CanvasGrid />
                        {selectedFile && (
                            <TimestepViewer 
                                fileInfo={selectedFile}
                                currentTimestep={currentTimestep}
                                isPlaying={isPlaying}
                                playSpeed={playSpeed}
                                timesteps={timesteps}
                                onTimestepChange={handleTimestepChange}
                            />
                        )}
                        <OrbitControls 
                            enableDamping 
                            dampingFactor={0.05} 
                            rotateSpeed={0.7}
                            maxDistance={30}
                            minDistance={2}
                            target={[0, 3, 0]}
                        />
                        <Environment preset='city' />
                    </Canvas>
                </FileUpload>
                
                <TimestepControls
                    fileInfo={selectedFile || null}
                    timesteps={timesteps}
                    currentTimestep={currentTimestep}
                    onTimestepChange={handleTimestepChange}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    playSpeed={playSpeed}
                    onSpeedChange={handleSpeedChange}
                />
            </div>

            <section className='editor-dislocations-button-container'>
                <IoAddOutline className='editor-dislocations-button-icon' />
                <span className='editor-dislocations-button-text'>Get Dislocations</span>
            </section>
        </main>
    );
};

export default App;