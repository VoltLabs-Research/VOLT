import { useState, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Environment } from '@react-three/drei';
import { IoAddOutline } from 'react-icons/io5';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';
import TimestepViewer from './components/TimestepViewer';
import useTimestepStream from './hooks/useTimestepStream';
import TimestepControls from './components/TimestepControls';
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
    const [folder, setFolder] = useState<object | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [currentTimestep, setCurrentTimestep] = useState(0);
    const { data, error } = useTimestepStream({ folderId: folder?.folder_id || null, timestepId: currentTimestep });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentIndexRef = useRef(0);

    useEffect(() => {
        if(!folder) return;
        console.log(folder)
        currentIndexRef.current = folder.timesteps.indexOf(currentTimestep);
    }, [currentTimestep, folder]);

    useEffect(() => {
        if(!folder) return;

        if (!isPlaying || folder.timesteps.length === 0) return;

        const advance = () => {
            if(!folder) return;

            currentIndexRef.current = (currentIndexRef.current + 1) % folder.timesteps.length;
            setCurrentTimestep(folder.timesteps[currentIndexRef.current]);

            timeoutRef.current = setTimeout(advance, 1000 / playSpeed);
        };

        timeoutRef.current = setTimeout(advance, 1000 / playSpeed);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [isPlaying, playSpeed, folder, currentTimestep]);

    const handleUploadError = (error: string) => {
        console.error('OpenDXA: Upload error:', error);
    };

    const handleFolderSelection = (folder_data) => {
        setFolder(folder_data);
        setCurrentTimestep(folder_data.min_timestep);
    };

    return (
        <main className='editor-container'>
            {/* <AnalysisConfig /> */}
            <FileList onFileSelect={handleFolderSelection} />

            {folder && (
                <TimestepControls
                    folderInfo={folder}
                    currentTimestep={currentTimestep}
                    onTimestepChange={setCurrentTimestep}
                    isPlaying={isPlaying}
                    onPlayPause={() => setIsPlaying(p => !p)}
                    playSpeed={playSpeed}
                    onSpeedChange={setPlaySpeed}
                    isConnected={!!data}
                    isStreaming={isPlaying}
                    streamProgress={{
                        current: currentTimestep,
                        total: folder?.max_timestep ?? 1
                    }}
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

                        {folder && (
                            <TimestepViewer data={data} />
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