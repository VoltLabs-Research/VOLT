import React, { useMemo } from 'react';
import type { ExtendedTimestepViewerProps, AnalysisResult } from '../types/index';
import AtomParticles from './AtomParticles';
import DislocationViewer from './DislocationViewer';
import TimestepAnimator from './TimestepAnimator';

const TimestepViewer: React.FC<ExtendedTimestepViewerProps & {
    showDislocations?: boolean;
    analysis?: AnalysisResult | null; // AnalysisResult from useDislocationAnalysis
}> = ({ 
    currentTimestep, 
    isPlaying, 
    playSpeed, 
    timesteps, 
    onTimestepChange,
    timestepData,
    error,
    showDislocations = false,
    analysis
}) => {
    const { atoms, scale, centerOffset } = useMemo(() => {
        if (!timestepData) return { atoms: [], scale: 1, centerOffset: [0, 0, 0] as [number, number, number] };
        
        const atomsData = timestepData.positions.map((pos: number[], index: number) => ({
            x: pos[0],
            y: pos[1],
            z: pos[2],
            type: timestepData.atom_types[index] || 1
        }));

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        atomsData.forEach((atom: any) => {
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

        const centeredAtoms = atomsData.map((atom: any) => ({
            ...atom,
            x: atom.x - centerX,
            y: atom.y - centerY,
            z: atom.z - centerZ
        }));

        return { 
            atoms: centeredAtoms, 
            scale: calculatedScale,
            centerOffset: [-centerX * calculatedScale, -centerZ * calculatedScale + 5, -centerY * calculatedScale] as [number, number, number]
        };
    }, [timestepData]);

    console.log('TimestepViewer atoms data:', {
        atomsCount: atoms.length,
        scale,
        centerOffset,
        atomsRange: atoms.length > 0 ? {
            x: [Math.min(...atoms.map(a => a.x)), Math.max(...atoms.map(a => a.x))],
            y: [Math.min(...atoms.map(a => a.y)), Math.max(...atoms.map(a => a.y))],
            z: [Math.min(...atoms.map(a => a.z)), Math.max(...atoms.map(a => a.z))]
        } : null
    });

           
    //  {atoms.length > 0 && <AtomParticles atoms={atoms} scale={scale} />}
    return (
        <>
            
            {/* Show dislocations using VTK data from analysis */}
            {showDislocations && analysis?.vtk_data && (
                <DislocationViewer
                    vtkData={analysis.vtk_data}
                    scale={0.3}
                    centerOffset={centerOffset}
                    showBurgersVectors={true}
                    colorByBurgersVector={true}
                />
            )}
            
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