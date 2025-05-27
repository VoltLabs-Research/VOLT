import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CiPlay1 } from "react-icons/ci";
import { CiPause1 } from "react-icons/ci";
import { getTimestepPositions } from '../services/api';
import type { FileInfo } from '../types/index';
import * as THREE from 'three';

interface AtomPosition {
    x: number;
    y: number;
    z: number;
    type: number;
}

interface TimestepData {
    positions: number[][];
    atom_types: number[];
    atoms_count: number;
    box_bounds: number[][];
}

interface TimestepViewerProps {
    fileInfo: FileInfo;
    currentTimestep: number;
    isPlaying: boolean;
    playSpeed: number;
    timesteps: number[];
    onTimestepChange: (timestep: number) => void;
}

const AtomParticles: React.FC<{ atoms: AtomPosition[]; scale: number }> = ({ atoms, scale }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    const yOffset = 5; 
    
    const colorArray = useMemo(() => {
        const colors = new Float32Array(atoms.length * 3);
        const typeColors = {
            1: new THREE.Color(0xff4444),
            2: new THREE.Color(0x44ff44),
            3: new THREE.Color(0x4444ff),
            4: new THREE.Color(0xffff44),
            5: new THREE.Color(0xff44ff),
            6: new THREE.Color(0x44ffff),
        };
        
        atoms.forEach((atom, i) => {
            const color = typeColors[atom.type as keyof typeof typeColors] || new THREE.Color(0xffffff);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        });
        
        return colors;
    }, [atoms]);

    useEffect(() => {
        if (!meshRef.current || atoms.length === 0) return;

        const tempMatrix = new THREE.Matrix4();
        atoms.forEach((atom, i) => {
            tempMatrix.setPosition(
                atom.x * scale, 
                (atom.z * scale) + yOffset,
                atom.y * scale
            );
            meshRef.current!.setMatrixAt(i, tempMatrix);
        });
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        
        if (meshRef.current.geometry.attributes.color) {
            meshRef.current.geometry.attributes.color.array = colorArray;
            meshRef.current.geometry.attributes.color.needsUpdate = true;
        }
    }, [atoms, colorArray, scale, yOffset]);

    if (atoms.length === 0) return null;

    const sphereRadius = Math.max(0.02, 1 * scale);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, atoms.length]}>
            <sphereGeometry args={[sphereRadius, 12, 8]}>
                <instancedBufferAttribute
                    attach='attributes-color'
                    args={[colorArray, 3]}
                />
            </sphereGeometry>
            <meshPhongMaterial vertexColors />
        </instancedMesh>
    );
};

const TimestepAnimator: React.FC<{
    timesteps: number[];
    currentTimestep: number;
    onTimestepChange: (timestep: number) => void;
    isPlaying: boolean;
    playSpeed: number;
}> = ({ timesteps, currentTimestep, onTimestepChange, isPlaying, playSpeed }) => {
    const lastUpdateRef = useRef<number>(0);

    useFrame((state) => {
        if (!isPlaying || timesteps.length === 0) return;
        
        const now = state.clock.elapsedTime * 1000;
        const interval = 1000 / playSpeed;
        
        if (now - lastUpdateRef.current > interval) {
            const currentIndex = timesteps.indexOf(currentTimestep);
            const nextIndex = (currentIndex + 1) % timesteps.length;
            onTimestepChange(timesteps[nextIndex]);
            lastUpdateRef.current = now;
        }
    });

    return null;
};

export const TimestepViewer: React.FC<TimestepViewerProps> = ({ 
    fileInfo, 
    currentTimestep, 
    isPlaying, 
    playSpeed, 
    timesteps, 
    onTimestepChange 
}) => {
    const [timestepData, setTimestepData] = useState<TimestepData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { atoms, scale, boundingBox } = useMemo(() => {
        if (!timestepData) return { atoms: [], scale: 1, boundingBox: null };
        
        const atomsData = timestepData.positions.map((pos, index) => ({
            x: pos[0],
            y: pos[1],
            z: pos[2],
            type: timestepData.atom_types[index] || 1
        }));

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        atomsData.forEach(atom => {
            minX = Math.min(minX, atom.x);
            maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y);
            maxY = Math.max(maxY, atom.y);
            minZ = Math.min(minZ, atom.z);
            maxZ = Math.max(maxZ, atom.z);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        const maxSize = Math.max(sizeX, sizeY, sizeZ);

        const targetSize = 10;
        const calculatedScale = maxSize > 0 ? targetSize / maxSize : 1;

        const centeredAtoms = atomsData.map(atom => ({
            ...atom,
            x: atom.x - centerX,
            y: atom.y - centerY,
            z: atom.z - centerZ
        }));

        console.log('Simulation bounds:', {
            x: [minX, maxX],
            y: [minY, maxY], 
            z: [minZ, maxZ],
            center: [centerX, centerY, centerZ],
            size: [sizeX, sizeY, sizeZ],
            maxSize,
            scale: calculatedScale
        });

        return { 
            atoms: centeredAtoms, 
            scale: calculatedScale,
            boundingBox: {
                min: [minX, minY, minZ],
                max: [maxX, maxY, maxZ],
                center: [centerX, centerY, centerZ],
                size: [sizeX, sizeY, sizeZ]
            }
        };
    }, [timestepData]);

    useEffect(() => {
        const loadTimestepData = async () => {
            if (currentTimestep === 0 || !fileInfo) return;
            
            setLoading(true);
            setError(null);
            
            try {
                console.log(`Loading timestep ${currentTimestep} for file ${fileInfo.file_id}`);
                const data = await getTimestepPositions(fileInfo.file_id, currentTimestep);
                console.log('Received data:', data);
                
                setTimestepData({
                    positions: data.positions,
                    atom_types: data.atom_types,
                    atoms_count: data.atoms_count,
                    box_bounds: data.box_bounds
                });
            } catch (err: any) {
                const errorMessage = err.response?.data?.detail || err.message || 'Unknown error';
                setError(`Error loading timestep data: ${errorMessage}`);
                console.error('Error loading timestep data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadTimestepData();
    }, [fileInfo.file_id, currentTimestep]);

    if (error) {
        return (
            <mesh position={[0, 2, 0]}>
                <boxGeometry args={[3, 0.5, 0.1]} />
                <meshBasicMaterial color='red' />
            </mesh>
        );
    }

    return (
        <>
            {atoms.length > 0 && <AtomParticles atoms={atoms} scale={scale} />}
            
            <TimestepAnimator
                timesteps={timesteps}
                currentTimestep={currentTimestep}
                onTimestepChange={onTimestepChange}
                isPlaying={isPlaying}
                playSpeed={playSpeed}
            />
        </>
    );
};

export const TimestepControls: React.FC<{
    fileInfo: FileInfo | null;
    timesteps: number[];
    currentTimestep: number;
    onTimestepChange: (timestep: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    playSpeed: number;
    onSpeedChange: (speed: number) => void;
}> = ({ 
    fileInfo, 
    timesteps, 
    currentTimestep, 
    onTimestepChange, 
    isPlaying, 
    onPlayPause, 
    playSpeed, 
    onSpeedChange 
}) => {
    if (!fileInfo || timesteps.length === 0) return null;

    const currentIndex = timesteps.indexOf(currentTimestep);

    return (
        <div className='editor-floating-container editor-timestep-controls'>
            <button
                onClick={onPlayPause}
                className='editor-timestep-controls-play-pause-button'
            >
                {isPlaying ? <CiPause1 /> : <CiPlay1 />}   
            </button>

            <div className='editor-timesteps-controls-slider'>
                <label>
                    <input
                        type='range'
                        min={0}
                        max={timesteps.length - 1}
                        value={currentIndex}
                        onChange={(e) => onTimestepChange(timesteps[parseInt(e.target.value)])}
                        className='editor-timestep-controls-slider'
                        style={{
                            '--progress': `${(currentIndex / (timesteps.length - 1)) * 100}%`
                        }}
                    />
                    {currentTimestep} / {timesteps[timesteps.length - 1]}
                </label>
            </div>

            <div className='editor-timesteps-controls-speed'>
                <label>
                    Speed:
                    <input
                        type='range'
                        min={0.1}
                        max={2}
                        step={0.1}
                        value={playSpeed}
                        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                        className='speed-slider'
                        style={{
                            '--progress': `${playSpeed / (2) * 100}%`
                        }}
                    />
                    {playSpeed.toFixed(1)}x
                </label>
            </div>
        </div>
    );
};