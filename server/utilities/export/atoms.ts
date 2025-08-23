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

import { ParsedFrame, AtomsGroupedByType } from '@/types/utilities/export/atoms';
import { LammpsAtom } from '@/types/utilities/lammps';
import { assembleAndWriteGLB } from '@/utilities/export/utils';
import { readLargeFile } from '@/utilities/fs';

class LAMMPSToGLBExporter{
    private lammpsTypeColors: Map<number, number[]> = new Map([
        [0, [0.5, 0.5, 0.5, 1.0]],
        [1, [1.0, 0.267, 0.267, 1.0]],
        [2, [0.267, 1.0, 0.267, 1.0]],
        [3, [0.267, 0.267, 1.0, 1.0]],
        [4, [1.0, 1.0, 0.267, 1.0]],
        [5, [1.0, 0.267, 1.0, 1.0]],
        [6, [0.267, 1.0, 1.0, 1.0]]
    ]);

    private readonly STRUCTURE_COLORS: { [key: string]: number[] } = {
        'FCC': [102, 255, 102],
        'HCP': [255, 102, 102],
        'BCC': [102, 102, 255],
        'CUBIC_DIAMOND': [19, 160, 254],
        'CUBIC_DIAMOND_FIRST_NEIGH': [0, 254, 245],
        'CUBIC_DIAMOND_SECOND_NEIGH': [126, 254, 181],
        'HEX_DIAMOND_FIRST_NEIGH': [254, 220, 0],
        'HEX_DIAMOND_SECOND_NEIGH': [204, 229, 81],
        'HEX_DIAMOND': [254, 137, 0],
        'OTHER': [242, 242, 242]
    };

    private static calculateAtomBounds(atoms: LammpsAtom[]): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }{
        let minX = Number.MAX_VALUE, maxX = Number.MIN_VALUE;
        let minY = Number.MAX_VALUE, maxY = Number.MIN_VALUE;
        let minZ = Number.MAX_VALUE, maxZ = Number.MIN_VALUE;

        for(const atom of atoms){
            minX = Math.min(minX, atom.x); maxX = Math.max(maxX, atom.x);
            minY = Math.min(minY, atom.y); maxY = Math.max(maxY, atom.y);
            minZ = Math.min(minZ, atom.z); maxZ = Math.max(maxZ, atom.z);
        }

        return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
    }

    // TODO: DUPLICATED CODE!?
    async parseFrame(filePath: string, extractTimestepInfo: Function): Promise<ParsedFrame>{
        let timestepFound = false;
        let atoms: LammpsAtom[] = [];
        let inAtomsSection = false;
        let atomsHeader = '';

        const result = await readLargeFile(filePath, {
            maxLines: 1000,
            onLine: (line) => {
                const trimmed = line.trim();
                if(!timestepFound && trimmed.includes('TIMESTEP')){
                    timestepFound = true;
                }

                if(trimmed.startsWith('ITEM: ATOMS')){
                    atomsHeader = trimmed;
                    inAtomsSection = true;
                    return;
                }

                if(trimmed.startsWith('ITEM:') && inAtomsSection){
                    inAtomsSection = false;
                    return;
                }

                if(inAtomsSection && trimmed){
                    const parts = trimmed.split(/\s+/);
                    if(parts.length >= 5){
                        atoms.push({
                            id: parseInt(parts[0]),
                            type: parseInt(parts[1]),
                            x: parseFloat(parts[2]),
                            y: parseFloat(parts[3]),
                            z: parseFloat(parts[4])
                        });
                    }
                }
            },
            onProgress: (lineCount) => {
                if(lineCount % 50000 === 0){
                    console.log(`Reading line ${lineCount.toLocaleString()}... (${atoms.length.toLocaleString()} atoms found)`);
                }
            }
        });

        const timestepInfo = extractTimestepInfo(result.lines);
        if(!timestepInfo){
            throw new Error('Could not extract timestep information from file');
        }

        return { timestepInfo, atoms };
    }

    static calculateOptimalRadius(atoms: LammpsAtom[]): number{
        let minDistance = Number.MAX_VALUE;
        const sampleSize = Math.min(1000, atoms.length);

        const sampledAtoms = atoms
            .sort(() => Math.random() - 0.5)
            .slice(0, sampleSize);

        let comparisons = 0;
        const maxComparisons = 10000;

        for(let i = 0; i < sampledAtoms.length - 1 && comparisons < maxComparisons; i++){
            for(let j = i + 1; j < Math.min(i + 20, sampledAtoms.length) && comparisons < maxComparisons; j++){
                const atom1 = sampledAtoms[i];
                const atom2 = sampledAtoms[j];

                const dx = atom1.x - atom2.x;
                const dy = atom1.y - atom2.y;
                const dz = atom1.z - atom2.z;

                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if(distance > 0.1 && distance < minDistance){
                    minDistance = distance;
                }

                comparisons++;
            }
        }

        if(minDistance === Number.MAX_VALUE){
            console.warn('Could not calculate minimum distance, using default radius');
            return 0.8;
        }

        let optimalRadius = 0.35 * minDistance;
        return Math.max(0.1, Math.min(3.0, optimalRadius));
    }

    public async exportAtomsToPointCloudGLB(
        positions: Float32Array,
        colors: Float32Array,
        outputFilePath: string,
        bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
        optimalRadius: number
    ): Promise<void>{
        const glb: any = {
            asset: { 
                version: '2.0', 
                generator: 'OpenDXA PointCloud Exporter'
            },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ mesh: 0 }],
            meshes: [],
            materials: [],
            accessors: [],
            bufferViews: [],
            buffers: []
        };

        const positionBufferSize = positions.byteLength;
        const colorBufferSize = colors.byteLength;
        const totalBufferSize = positionBufferSize + colorBufferSize;

        const arrayBuffer = new ArrayBuffer(totalBufferSize);
        
        new Float32Array(
            arrayBuffer,
            0,
            positions.length
        ).set(positions);

        new Float32Array(
            arrayBuffer,
            positionBufferSize,
            colors.length
        ).set(colors);

        glb.buffers.push({ byteLength: totalBufferSize });
        glb.bufferViews.push({ 
            buffer: 0, 
            byteOffset: 0,
            byteLength: positionBufferSize, 
            target: 34962 
        });

        glb.bufferViews.push({ 
            buffer: 0, 
            byteOffset: positionBufferSize, 
            byteLength: colorBufferSize, 
            target: 34962 
        });

        glb.accessors.push({ 
            bufferView: 0, 
            componentType: 5126, 
            count: positions.length / 3, 
            type: 'VEC3', 
            min: [bounds.min.x, bounds.min.y, bounds.min.z], 
            max: [bounds.max.x, bounds.max.y, bounds.max.z] 
        });

        glb.accessors.push({ 
            bufferView: 1, 
            componentType: 5126, 
            count: colors.length / 3,
            type: 'VEC3' 
        });
        
        glb.materials.push({ 
            name: 'PointCloudMaterial', 
            pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } 
        });

        glb.meshes.push({
            primitives: [{
                attributes: { POSITION: 0, COLOR_0: 1 },
                material: 0,
                // POINTS
                mode: 0 
            }],
            extras: {
                optimalRadius: optimalRadius
            }
        });

        assembleAndWriteGLB(glb, arrayBuffer, outputFilePath);
    }

    async exportAtomsToGLB(
        filePath: string,
        outputFilePath: string,
        extractTimestepInfo: Function
    ): Promise<void> {
        const frame = await this.parseFrame(filePath, extractTimestepInfo);

        const positions = new Float32Array(frame.atoms.length * 3);
        const colors = new Float32Array(frame.atoms.length * 3);
        const optimalRadius = LAMMPSToGLBExporter.calculateOptimalRadius(frame.atoms);

        frame.atoms.forEach((atom, i) => {
            const posIdx = i * 3;
            positions[posIdx] = atom.x;
            positions[posIdx + 1] = atom.y;
            positions[posIdx + 2] = atom.z;

            const color = this.lammpsTypeColors.get(atom.type) || this.lammpsTypeColors.get(0)!;
            colors[posIdx] = color[0];
            colors[posIdx + 1] = color[1];
            colors[posIdx + 2] = color[2];
        });

        const bounds = LAMMPSToGLBExporter.calculateAtomBounds(frame.atoms);
        await this.exportAtomsToPointCloudGLB(positions, colors, outputFilePath, bounds, optimalRadius);
    }

public exportAtomsTypeToGLB(
        atomsByType: AtomsGroupedByType,
        outputFilePath: string
    ): void{
        const totalAtoms = Object.values(atomsByType).reduce((sum, atoms) => sum + atoms.length, 0);
        const positions = new Float32Array(totalAtoms * 3);
        const colors = new Float32Array(totalAtoms * 3);
        let atomIndex = 0;

        for(const [typeName, atoms] of Object.entries(atomsByType)){
            const key = typeName.toUpperCase().replace(/ /g, '_');
            const color = this.STRUCTURE_COLORS[key] || this.STRUCTURE_COLORS['OTHER'];
            
            for(const atom of atoms){
                const i = atomIndex * 3;
                positions[i] = atom.pos[0];
                positions[i + 1] = atom.pos[1];
                positions[i + 2] = atom.pos[2];
                colors[i] = color[0] / 255;
                colors[i + 1] = color[1] / 255;
                colors[i + 2] = color[2] / 255;
                atomIndex++;
            }
        }

        const allAtomsFlat = Object.values(atomsByType).flat().map(a => ({ x: a.pos[0], y: a.pos[1], z: a.pos[2] } as LammpsAtom));
        const bounds = LAMMPSToGLBExporter.calculateAtomBounds(allAtomsFlat);
        const optimalRadius = LAMMPSToGLBExporter.calculateOptimalRadius(allAtomsFlat);
        this.exportAtomsToPointCloudGLB(positions, colors, outputFilePath, bounds, optimalRadius);
    }
};

export default LAMMPSToGLBExporter;