/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Environment } from '@react-three/drei';
import './Scene3D.css';

interface Scene3DProps {
    children?: React.ReactNode;
    cameraControlsEnabled?: boolean;
    onCameraControlsRef?: (ref: any) => void;
}

const CanvasGrid = React.memo(() => {
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
});

const Scene3D: React.FC<Scene3DProps> = ({
    children,
    cameraControlsEnabled = true,
    onCameraControlsRef
}) => {
    const orbitControlsRef = useRef<any>(null);

    useEffect(() => {
        if (onCameraControlsRef) {
            onCameraControlsRef(orbitControlsRef.current);
        }
    }, [onCameraControlsRef]);

    const cameraConfig = useMemo(() => ({
        position: [12, 8, 12] as [number, number, number],
        fov: 50
    }), []);

    const lightConfig = useMemo(() => ({
        ambient: { intensity: 0.8 }, 
        directional: {
            position: [15, 15, 15] as [number, number, number],
            intensity: 2.0, 
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

            <directionalLight
                position={[-10, 10, -10]}
                intensity={0.8}
                color="#ffffff"
            />
            
            <hemisphereLight
                skyColor="#87CEEB"
                groundColor="#362d1d"
                intensity={0.5}
            />
            
            <CanvasGrid />
            
            <OrbitControls 
                ref={orbitControlsRef}
                {...orbitControlsConfig}
                enabled={cameraControlsEnabled}
            />
                                    
            <Environment preset='city' />

            {children}
        </Canvas>
    );
};

export default Scene3D;