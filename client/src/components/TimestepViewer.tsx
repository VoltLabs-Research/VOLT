import React, { useMemo } from 'react';
import AtomParticles from './AtomParticles'; 

interface AtomsData {
    positions: Float32Array;
    ids: Uint32Array;
    lammps_types: Uint8Array;
    total_atoms: number;
    timestep: number;
}

interface TimestepViewerProps {
    data: AtomsData;
    onCameraControlsEnable: (enabled: boolean) => void;
}

const TimestepViewer: React.FC<TimestepViewerProps> = ({ data, onCameraControlsEnable }) => {

    const atomObjects = useMemo(() => {
        if (!data || !data.positions || data.total_atoms === 0) {
            return [];
        }

        console.log(`Transforming ${data.total_atoms} atoms from TypedArrays to object array...`);

        const atoms = [];
        const { positions, ids, lammps_types, total_atoms } = data;

        for (let i = 0; i < total_atoms; i++) {
            const posIndex = i * 3;
            atoms.push({
                x: positions[posIndex],
                y: positions[posIndex + 1],
                z: positions[posIndex + 2],
                id: ids[i],
                lammps_type: lammps_types[i],
            });
        }
        
        console.log(`Transformation complete. Created ${atoms.length} atom objects.`);
        return atoms;
    }, [data]);

    if (atomObjects.length === 0) {
        return null;
    }

    return (
        <AtomParticles
            atoms={atomObjects}
            scale={0.1}
            onCameraControlsEnable={onCameraControlsEnable}
        />
    );
};

export default TimestepViewer;