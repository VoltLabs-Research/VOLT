import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Environment } from '@react-three/drei';
import { IoAddOutline } from 'react-icons/io5';
import { FileUpload } from './components/FileUpload';
import './App.css';
import { FileList } from './components/FileList';

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
    const handleUploadError = (error: string) => {
        console.error('Upload error:', error);
    };

    const handleUploadSuccess = () => {
    };

    return (
        <main className='editor-container'>
            {/* <AnalysisConfig /> */}
            <FileList />

            <section className='editor-camera-info-container'>
                <h3 className='editor-camera-info-title'>Perspective Camera</h3>
                <p className='editor-camera-info-description'>
                    Timestep Visualization 
                </p>
            </section>

            <div className='editor-timestep-viewer-container'>
                <FileUpload onUploadError={handleUploadError} onUploadSuccess={handleUploadSuccess}>
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