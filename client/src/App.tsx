import { useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Environment } from '@react-three/drei';
import { IoAddOutline } from 'react-icons/io5';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import TimestepViewer from './components/TimestepViewer';
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
    // TODO: use react redux
    const [folderId, setFolderId] = useState<string | null>(null);
    const [currentTimestep, setCurrentTimestep] = useState<number>(0);

    const handleUploadError = (error: string) => {
        console.error('OpenDXA: Upload error:', error);
    };

    const handleFolderSelection = (uploadedFolderId: string) => {
        setFolderId(uploadedFolderId);

        // When selecting a directory, we load the first timestep found by default. 
        // From the server, if timestep == -1, then load the first timestep from the directory.
        setCurrentTimestep(-1);
    };

    return (
        <main className='editor-container'>
            {/* <AnalysisConfig /> */}
            <FileList onFileSelect={handleFolderSelection} />

            <section className='editor-camera-info-container'>
                <h3 className='editor-camera-info-title'>Perspective Camera</h3>
                <p className='editor-camera-info-description'>
                    Timestep Visualization 
                </p>
            </section>

            <div className='editor-timestep-viewer-container'>
                <FileUpload onUploadError={handleUploadError} onUploadSuccess={handleFolderSelection}>
                    <Canvas shadows camera={{ position: [12, 8, 12], fov: 50 }}>
                        {/* @ts-ignore */}
                        <ambientLight intensity={0.4} />
                        {/* @ts-ignore */}
                        <directionalLight
                            castShadow
                            position={[15, 15, 15]}
                            intensity={1.0}
                            shadow-mapSize={[2048, 2048]}
                            shadow-camera-far={100}
                            shadow-camera-left={-15}
                            shadow-camera-right={15}
                            shadow-camera-top={15}
                            shadow-camera-bottom={-15}
                        />
                        <CanvasGrid />
                        <OrbitControls 
                            enableDamping 
                            dampingFactor={0.05} 
                            rotateSpeed={0.7}
                            maxDistance={30}
                            minDistance={2}
                            target={[0, 3, 0]}
                        />
                        <Environment preset='city' />

                        {folderId && (
                            <TimestepViewer
                                folderId={folderId}
                                currentTimestep={currentTimestep}
                                isPlaying={false}
                                playSpeed={1}
                                timesteps={[0]}
                                onTimestepChange={setCurrentTimestep}
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