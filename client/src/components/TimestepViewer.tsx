import React, { useState, useEffect, useMemo } from 'react';
import { getTimestepPositions } from '../services/api';
import type { TimestepData, TimestepViewerProps } from '../types/index';
import AtomParticles from './AtomParticles';
import TimestepAnimator from './TimestepAnimator';

const TimestepViewer: React.FC<TimestepViewerProps> = ({ 
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

export default TimestepViewer;