import React, { useEffect, useMemo } from 'react';
import AtomParticles from './AtomParticles';
import DislocationViewer from './DislocationViewer';
import TimestepAnimator from './TimestepAnimator';
import useTimestepStream from '../hooks/useTimestepStream';

const TimestepViewer: React.FC<any & {
    folderId: string;
    showDislocations?: boolean;
    analysis?: any | null
}> = ({
    folderId,
    currentTimestep,
    isPlaying,
    playSpeed,
    timesteps,
    onTimestepChange,
    analysis,
    showDislocations = false
}) => {
    const { data, error } = useTimestepStream({ folderId, timestepId: currentTimestep });

    useEffect(() => {
        console.log(data)
    }, [data]);

    const { atoms, scale, centerOffset } = useMemo(() => {
        if(!data?.positions){
            return {
                atoms: [],
                scale: 1,
                centerOffset: [0, 0, 0]
            }
        }

        const atomsData = data.positions.map((position: number[], index: number) => ({
            x: position[0],
            y: position[1],
            z: position[2],
            // TODO: This should be dynamic.
            type: 1
        }));

        let minX = Infinity;
        let maxX = -Infinity;

        let minY = Infinity;
        let maxY = -Infinity;

        let minZ = Infinity;
        let maxZ = -Infinity;

        atomsData.forEach((atom) => {
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
        const calculatedScale = maxSize > 0 ? (targetSize / maxSize) : 1;

        const centeredAtoms = atomsData.map((atom) => ({
            ...atom,
            x: atom.x - centerX,
            y: atom.y - centerY,
            z: atom.z - centerZ
        }));

        return {
            atoms: centeredAtoms,
            scale: calculatedScale,
            centerOffset: [
                -centerX * calculatedScale,
                -centerZ * (calculatedScale + 5),
                -centerY * calculatedScale
            ]
        };
    }, [data]);

    // TODO: if error return bla bla 

    return (
        <React.Fragment>
            {atoms.length > 0 && <AtomParticles atoms={atoms} scale={scale} /> }
        </React.Fragment>
    )
};

export default TimestepViewer;