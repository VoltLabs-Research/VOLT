import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Stats, Environment } from '@react-three/drei';
import { IoAddOutline } from 'react-icons/io5';
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


    return (
        <main className='editor-container'>
            <section className='editor-camera-info-container'>
                <h3 className='editor-camera-info-title'>Perspective Camera</h3>
                <p className='editor-camera-info-description'>Timestep Visualization</p>
            </section>

            <section className='editor-timestep-viewer-container'>
                <Canvas shadows camera={{ position: [5, 5, 5] }}>
                    <ambientLight intensity={0.3} />
                    <directionalLight
                        castShadow
                        position={[10, 15, 10]}
                        intensity={1.2}
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                        shadow-camera-far={50}
                        shadow-camera-left={-10}
                        shadow-camera-right={10}
                        shadow-camera-top={10}
                        shadow-camera-bottom={-10}
                    />
                    <CanvasGrid />
                    <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.7} />
                    <Environment preset='city' />
                 </Canvas>
            </section>

            <section className='editor-dislocations-button-container'>
                <IoAddOutline className='editor-dislocations-button-icon' />
                <span className='editor-dislocations-button-text'>Get Dislocations</span>
            </section>
        </main>
    );
};

export default App;