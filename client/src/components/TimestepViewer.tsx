import React, { useMemo } from 'react';
import type { ExtendedTimestepViewerProps } from '../types/index';
import AtomParticles from './AtomParticles';
import TimestepAnimator from './TimestepAnimator';

const TimestepViewer: React.FC<ExtendedTimestepViewerProps> = ({ 
    fileInfo, 
    currentTimestep, 
    isPlaying, 
    playSpeed, 
    timesteps, 
    onTimestepChange,
    timestepData,
    loading,
    error
}) => {
    const { atoms, scale, boundingBox } = useMemo(() => {
        if (!timestepData) return { atoms: [], scale: 1, boundingBox: null };
        
        const atomsData = timestepData.positions.map((pos: number[], index: number) => ({
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