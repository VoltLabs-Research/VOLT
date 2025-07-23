import React, { useMemo, useRef, useEffect } from 'react';
import CanvasGrid from '@/components/atoms/CanvasGrid';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import useEditorStore from '@/stores/editor';
import './Scene3D.css';

interface Scene3DProps {
    children?: React.ReactNode;
    cameraControlsEnabled?: boolean;
    onCameraControlsRef?: (ref: any) => void;
}

const Scene3D: React.FC<Scene3DProps> = ({
    children,
    cameraControlsEnabled = true,
    onCameraControlsRef
}) => {
    const orbitControlsRef = useRef<any>(null);
    const activeSceneObject = useEditorStore((state) => state.activeSceneObject);

    useEffect(() => {
        if(onCameraControlsRef){
            onCameraControlsRef(orbitControlsRef.current);
        }
    }, [onCameraControlsRef]);

    const cameraConfig = useMemo(() => ({
        position: [8, 6, 8] as [number, number, number],
        fov: 50
    }), []);

    return (
        <Canvas
            gl={{ localClippingEnabled: true, antialias: true }}
            shadows
            camera={cameraConfig}
            style={{ backgroundColor: '#1E1E1E' }}
            dpr={[1, 2]}
        >
            {['defect_mesh', 'interface_mesh'].includes(activeSceneObject) && (
                <>
                    <ambientLight intensity={0.15} />
                    <directionalLight
                        castShadow
                        position={[10, 15, -5]}
                        intensity={2.0}
                        shadow-mapSize={[4096, 4096]}
                        shadow-bias={-0.0001} 
                    />

                    <directionalLight
                        position={[-10, 5, 10]}
                        intensity={0.2}
                    />
                    
                    <EffectComposer>
                        <SSAO
                            blendFunction={BlendFunction.MULTIPLY} 
                            intensity={10}
                            radius={0.2} 
                            luminanceInfluence={0.5}
                            worldDistanceThreshold={1.0}
                            worldDistanceFalloff={0.5}
                            worldProximityThreshold={1.0}
                            worldProximityFalloff={0.5}
                        />
                    </EffectComposer>
                </>
            )}
           
            {['trajectory', 'atoms_colored_by_type'].includes(activeSceneObject) && (
                <>
                    <ambientLight intensity={0.8} />

                    <directionalLight
                        castShadow
                        position={[15, 15, 15]}
                        intensity={2.0}
                        shadow-mapSize={[4096, 4096]}
                        shadow-camera-far={100}
                        shadow-camera-left={-15}
                        shadow-camera-right={15}
                        shadow-camera-top={15}
                        shadow-camera-bottom={-15}
                    />

                    <directionalLight
                        position={[-10, 10, -10]}
                        intensity={0.8}
                        color="#ffffff"
                    />
                    
                    <hemisphereLight
                        groundColor="#362d1d"
                        intensity={0.5}
                    />
                </>
            )}


            <OrbitControls
                ref={orbitControlsRef}
                makeDefault
                enableDamping
                dampingFactor={0.05}
                rotateSpeed={0.8}
                maxDistance={50}
                minDistance={2}
                target={[0, 2, 0]} 
                enabled={cameraControlsEnabled}
            />
            
            <CanvasGrid />

            {children}
        </Canvas>
    );
};

export default Scene3D;