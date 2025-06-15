import React, { useEffect, useMemo } from 'react';
import AtomParticles from './AtomParticles';

const TimestepViewer: React.FC<any> = ({ data }) => {
    useEffect(() => {
        console.log(data)
    }, [data]);

    const { atoms, scale, centerOffset } = useMemo(() => {
        if (!data?.atoms || data.atoms.length === 0) {
            return {
                atoms: [],
                scale: 1,
                centerOffset: [0, 0, 0]
            };
        }

        const atomsData = data.atoms.map((atom: any) => ({
            x: atom.position[0],
            y: atom.position[1],
            z: atom.position[2],
            type: atom.type
        }));

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

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
        const calculatedScale = maxSize > 0 ? targetSize / maxSize : 1;

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

    return (
        <>
            {atoms.length > 0 && <AtomParticles atoms={atoms} scale={scale} />}
        </>
    );
};

export default TimestepViewer;
