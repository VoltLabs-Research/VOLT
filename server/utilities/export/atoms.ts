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

import { ParsedFrame, AtomsGroupedByType, PerformanceProfile, GLTFExportOptions } from '@/types/utilities/export/atoms';
import { TimestepInfo, LammpsAtom } from '@/types/utilities/lammps';
import * as fs from 'fs';

class LAMMPSToGLTFExporter{
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
        'Other': [1.0, 1.0, 1.0],
        'FCC': [0.0, 1.0, 0.0],
        'HCP': [1.0, 0.0, 0.0],
        'BCC': [0.0, 0.0, 1.0],
        'Cubic diamond': [0.0, 1.0, 1.0],
        'Hexagonal diamond': [1.0, 0.5, 0.0],
        'Default': [0.5, 0.5, 0.5]
    };

    private parseAtoms(lines: string[]): LammpsAtom[]{
        const atoms: LammpsAtom[] = [];
        let inAtomsSection = false;

        for(const line of lines){
            const trimmed = line.trim();
            if(trimmed.startsWith('ITEM: ATOMS')){
                inAtomsSection = true;
                continue;
            }

            if(trimmed.startsWith('ITEM:') && inAtomsSection){
                break;
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
        }

        return atoms;
    }

    private static uniformSubsampling(atoms: LammpsAtom[], targetCount: number): LammpsAtom[]{
        const step = Math.floor(atoms.length / targetCount);
        const selected: LammpsAtom[] = [];
        for(let i = 0; i < atoms.length && selected.length < targetCount; i += step){
            selected.push(atoms[i]);
        }
        return selected;
    }

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

    private static boundaryPreservingSubsampling(atoms: LammpsAtom[], targetCount: number): LammpsAtom[]{
        if(atoms.length <= targetCount) return atoms;
        const bounds = this.calculateAtomBounds(atoms);
        const margin = 0.05;
        const xMargin = (bounds.max.x - bounds.min.x) * margin;
        const yMargin = (bounds.max.y - bounds.min.y) * margin;
        const zMargin = (bounds.max.z - bounds.min.z) * margin;

        const boundaryAtoms: LammpsAtom[] = [];
        const interiorAtoms: LammpsAtom[] = [];

        for(const atom of atoms){
            const isOnBoundary = (
                atom.x <= bounds.min.x + xMargin || atom.x >= bounds.max.x - xMargin ||
                atom.y <= bounds.min.y + yMargin || atom.y >= bounds.max.y - yMargin ||
                atom.z <= bounds.min.z + zMargin || atom.z >= bounds.max.z - zMargin
            );

            if(isOnBoundary){
                boundaryAtoms.push(atom);
            }else{
                interiorAtoms.push(atom);
            }
        }

        const minBoundaryCount = Math.min(boundaryAtoms.length, Math.floor(targetCount * 0.15));
        const remainingTarget = targetCount - minBoundaryCount;

        const selectedBoundary = this.uniformSubsampling(boundaryAtoms, minBoundaryCount);
        const selectedInterior = interiorAtoms.length <= remainingTarget ? interiorAtoms : this.uniformSubsampling(interiorAtoms, remainingTarget);

        const result = [...selectedBoundary, ...selectedInterior];
        return result;
    }

    private static stratifiedSubsampling(atoms: LammpsAtom[], targetCount: number): LammpsAtom[]{
        if(atoms.length <= targetCount) return atoms;
        const bounds = this.calculateAtomBounds(atoms);
        const regions = this.divideIntoOctants(atoms, bounds);
        const selected: LammpsAtom[] = [];
        const atomsPerRegion = Math.floor(targetCount / regions.length);
        let remainingTarget = targetCount;

        for(let i = 0; i < regions.length; i++){
            const region = regions[i];
            if(region.length === 0) continue;
            const isLastRegion = i === regions.length - 1;
            const regionTarget = isLastRegion ? remainingTarget : Math.min(atomsPerRegion, region.length);
            if(region.length <= regionTarget){
                selected.push(...region);
            }else{
                const regionSelected = this.uniformSubsampling(region, regionTarget);
                selected.push(...regionSelected);
            }

            remainingTarget -= regionTarget;
            if(remainingTarget <= 0) break;
        }

        return selected;
    }

    private static divideIntoOctants(atoms: LammpsAtom[], bounds: any): LammpsAtom[][]{
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        const centerY = (bounds.min.y + bounds.max.y) / 2;
        const centerZ = (bounds.min.z + bounds.max.z) / 2;

        const octants: LammpsAtom[][] = [[], [], [], [], [], [], [], []];

        for(const atom of atoms){
            const octantIndex =
               (atom.x >= centerX ? 1 : 0) +
               (atom.y >= centerY ? 2 : 0) +
               (atom.z >= centerZ ? 4 : 0);

            octants[octantIndex].push(atom);
        }

        return octants.filter((octant) => octant.length > 0);
    }

    private static subsampling(atoms: LammpsAtom[], targetCount: number, method: 'uniform' | 'boundary' | 'stratified'): LammpsAtom[]{
        if(atoms.length <= targetCount) return atoms;
        switch(method){
            case 'uniform':
                return this.uniformSubsampling(atoms, targetCount);
            case 'boundary':
                return this.boundaryPreservingSubsampling(atoms, targetCount);
            case 'stratified':
                return this.stratifiedSubsampling(atoms, targetCount);
            default:
                return this.boundaryPreservingSubsampling(atoms, targetCount);
        }
    }

    parseFrame(filePath: string, extractTimestepInfo: Function): ParsedFrame{
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        const timestepInfo = extractTimestepInfo(lines);
        if(!timestepInfo){
            throw new Error('Could not extract timestep information from file');
        }

        const atoms = this.parseAtoms(lines);

        return { timestepInfo, atoms };
    }

    private selectAtoms(atoms: LammpsAtom[], options: GLTFExportOptions, profile: PerformanceProfile): { atoms: LammpsAtom[], finalRadius: number }{
        let selectedAtoms = [...atoms];
        let finalRadius = options.atomRadius as number;

        if(selectedAtoms.length > profile.recommendedMaxAtoms){
            let method: 'uniform' | 'boundary' | 'stratified' = 'boundary';

            if(selectedAtoms.length > 2000000){
                method = 'stratified';
            }else if(selectedAtoms.length > 500000){
                method = 'boundary';
            }else{
                method = 'uniform';
            }

            selectedAtoms = LAMMPSToGLTFExporter.subsampling(selectedAtoms, profile.recommendedMaxAtoms, method);
            finalRadius = LAMMPSToGLTFExporter.calculateOptimalRadius(selectedAtoms);
            console.log(`Recalculated radius after optimization: ${finalRadius.toFixed(3)}`);
        }

        if(options.maxAtoms && selectedAtoms.length > options.maxAtoms){
            selectedAtoms = LAMMPSToGLTFExporter.boundaryPreservingSubsampling(selectedAtoms, options.maxAtoms);
            finalRadius = LAMMPSToGLTFExporter.calculateOptimalRadius(selectedAtoms);
            console.log(`Recalculated radius after second optimization: ${finalRadius.toFixed(3)}`);
        }

        const reductionPercent = ((atoms.length - selectedAtoms.length) / atoms.length * 100).toFixed(1);
        console.log(`Optimization complete: ${reductionPercent}% reduction(${selectedAtoms.length.toLocaleString()} final atoms)`);

        return { atoms: selectedAtoms, finalRadius };
    }

    private generateSphere(radius: number, segments: number, rings: number): {
        vertices: number[];
        indices: number[];
        bounds: { min: number[]; max: number[] }
    }{
        const vertices: number[] = [];
        const indices: number[] = [];

        let minX = radius, maxX = -radius;
        let minY = radius, maxY = -radius;
        let minZ = radius, maxZ = -radius;

        for(let ring = 0; ring <= rings; ring++){
            const phi = Math.PI * ring / rings;
            const y = Math.cos(phi) * radius;
            const ringRadius = Math.sin(phi) * radius;

            for(let segment = 0; segment <= segments; segment++){
                const theta = 2.0 * Math.PI * segment / segments;
                const x = Math.cos(theta) * ringRadius;
                const z = Math.sin(theta) * ringRadius;

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                minZ = Math.min(minZ, z);
                maxZ = Math.max(maxZ, z);

                vertices.push(x, y, z);

                const normLen = Math.sqrt(x * x + y * y + z * z);
                if(normLen > 0.0){
                    vertices.push(x / normLen, y / normLen, z / normLen);
                }else{
                    vertices.push(0, 1, 0);
                }
            }
        }

        for(let ring = 0; ring < rings; ring++){
            for(let segment = 0; segment < segments; segment++){
                const current = ring *(segments + 1) + segment;
                const next = current + segments + 1;

                indices.push(current, next, current + 1);
                indices.push(current + 1, next, next + 1);
            }
        }

        return {
            vertices,
            indices,
            bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
        };
    }

    private arrayToBase64(array: ArrayBuffer): string{
        return Buffer.from(array).toString('base64');
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

        let optimalRadius = 0.45 * minDistance;
        return Math.max(0.1, Math.min(3.0, optimalRadius));
    }

    static detectPerfomanceProfile(atomCount: number): PerformanceProfile{
        if(atomCount <= 10000){
            return {
                atomCount,
                recommendedMaxAtoms: atomCount,
                sphereResolution: { segments: 16, rings: 12 },
            };
        }else if(atomCount <= 100000){
            return {
                atomCount,
                recommendedMaxAtoms: atomCount,
                sphereResolution: { segments: 12, rings: 8 },
            };
        }else if(atomCount <= 500000){
            return {
                atomCount,
                recommendedMaxAtoms: 300000,
                sphereResolution: { segments: 8, rings: 6 },
            };
        }else if(atomCount <= 2000000){
            return {
                atomCount,
                recommendedMaxAtoms: 200000,
                sphereResolution: { segments: 4, rings: 2 },
            };
        }else{
            return {
                atomCount,
                recommendedMaxAtoms: 150000,
                sphereResolution: { segments: 4, rings: 2 },
            };
        }
    }

    static calculateRadiusFromDensity(timestepInfo: TimestepInfo, atomCount: number): number{
        const{ boxBounds } = timestepInfo;
        const volume = (boxBounds.xhi - boxBounds.xlo) *
           (boxBounds.yhi - boxBounds.ylo) *
           (boxBounds.zhi - boxBounds.zlo);
        const density = atomCount / volume;
        const averageDistance = Math.pow(1 / density, 1 / 3);
        const optimalRadius = averageDistance * 0.35;
        console.log('Optimal radius:', optimalRadius);
        return Math.max(0.1, Math.min(2.0, optimalRadius));
    }

    static calculateGlobalOptimalRadius(firstFrame: { timestepInfo: TimestepInfo, atoms: LammpsAtom[] }): number{
        const radiusFromAtoms = this.calculateOptimalRadius(firstFrame.atoms);
        const radiusFromDensity = this.calculateRadiusFromDensity(firstFrame.timestepInfo, firstFrame.atoms.length);
        const finalRadius = (radiusFromAtoms + radiusFromDensity) / 2;
        return finalRadius;
    }

    exportAtomsToGLTF(
        filePath: string,
        outputFilePath: string,
        extractTimestepInfo: Function,
        options: GLTFExportOptions = { atomRadius: 0.8 }
    ): void{
        const frame = this.parseFrame(filePath, extractTimestepInfo);
        const autoRadius = LAMMPSToGLTFExporter.calculateGlobalOptimalRadius(frame);

        const opts: Required<GLTFExportOptions> = {
            atomRadius: options.atomRadius ?? autoRadius,
            maxAtoms: options.maxAtoms ?? 0,
            maxInstancesPerMesh: options.maxInstancesPerMesh ?? 10000
        };

        console.log(`Using atom radius: ${opts.atomRadius.toFixed(3)}(${options.atomRadius ? 'specified' : 'auto-detected'})`);
        const profile = LAMMPSToGLTFExporter.detectPerfomanceProfile(frame.atoms.length);
        const{ atoms: selectedAtoms, finalRadius } = this.selectAtoms(frame.atoms, opts, profile);
        const{ segments, rings } = profile.sphereResolution;
        const sphere = this.generateSphere(finalRadius, segments, rings);

        console.log(`Exporting ${selectedAtoms.length} of ${frame.atoms.length} atoms(${(100.0 * selectedAtoms.length / frame.atoms.length).toFixed(1)}%)`);
        console.log(`Final atom radius: ${finalRadius.toFixed(3)}`);

        const gltf: any = {
            asset: {
                version: '2.0',
                generator: 'OpenDXA Lammps GLTF Exporter',
                copyright: 'https://github.com/rodyherrera/OpenDXA'
            },
            extensionsUsed: ['EXT_mesh_gpu_instancing'],
            extensionsRequired: ['EXT_mesh_gpu_instancing'],
            scene: 0,
            scenes: [{ nodes: [] }],
            nodes: [],
            meshes: [],
            materials: [],
            accessors: [],
            bufferViews: [],
            buffers: []
        };

        const vertexBufferSize = sphere.vertices.length * 4;
        const indexBufferSize = sphere.indices.length * 2;

        const vertexBufferOffset = 0
        const indexBufferOffset = vertexBufferSize;
        const alignedIndexBufferOffset = Math.ceil(indexBufferOffset / 4) * 4;

        let bufferSize = alignedIndexBufferOffset + indexBufferSize;
        let arrayBuffer = new ArrayBuffer(bufferSize);
        const vertexView = new Float32Array(arrayBuffer, vertexBufferOffset, sphere.vertices.length);
        const indexView = new Uint16Array(arrayBuffer, alignedIndexBufferOffset, sphere.indices.length);

        vertexView.set(sphere.vertices);
        indexView.set(sphere.indices);

        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: vertexBufferOffset,
            byteLength: vertexBufferSize,
            byteStride: 24,
            target: 34962
        },{
            buffer: 0,
            byteOffset: alignedIndexBufferOffset,
            byteLength: indexBufferSize,
            target: 34963
        });

        gltf.accessors.push({
            bufferView: 0,
            byteOffset: 0,
            componentType: 5126,
            count: sphere.vertices.length / 6,
            type: 'VEC3',
            min: sphere.bounds.min,
            max: sphere.bounds.max
        },{
            bufferView: 0,
            byteOffset: 12,
            componentType: 5126,
            count: sphere.vertices.length / 6,
            type: 'VEC3',
            min: [-1.0, -1.0, -1.0],
            max: [1.0, 1.0, 1.0]
        },{
            bufferView: 1,
            byteOffset: 0,
            componentType: 5123,
            count: sphere.indices.length,
            type: 'SCALAR'
        });

        const atomsByType = new Map<number, LammpsAtom[]>();
        for(const atom of selectedAtoms){
            if(!atomsByType.has(atom.type)){
                atomsByType.set(atom.type, []);
            }
            atomsByType.get(atom.type)!.push(atom);
        }

        let currentMeshIndex = 0;

        for(const [atomType, typeAtoms] of atomsByType){
            if(typeAtoms.length === 0) continue;
            const color = this.lammpsTypeColors.get(atomType) || this.lammpsTypeColors.get(0)!;
            gltf.materials.push({
                name: `Material_LammpsType_${atomType}`,
                pbrMetallicRoughness: {
                    baseColorFactor: color,
                    metallicFactor: 0.1,
                    roughnessFactor: 0.8
                }
            });

            const totalAtoms = typeAtoms.length;
            const chunks = Math.max(1, Math.ceil(totalAtoms / opts.maxInstancesPerMesh));
            const atomsPerChunk = Math.ceil(totalAtoms / chunks);
            for(let chunk = 0; chunk < chunks; chunk++){
                const startIdx = chunk * atomsPerChunk;
                const endIdx = Math.min(startIdx + atomsPerChunk, totalAtoms);
                if(startIdx >= endIdx) break;

                const chunkAtoms = typeAtoms.slice(startIdx, endIdx);
                const meshName = chunks > 1 ?
                    `AtomSphere_Type_${atomType}_Chunk_${chunk}` :
                    `AtomSphere_Type_${atomType}`;

                gltf.meshes.push({
                    name: meshName,
                    primitives: [{
                        attributes: { POSITION: 0, NORMAL: 1 },
                        indices: 2,
                        material: currentMeshIndex,
                        mode: 4
                    }]
                });

                const translations: number[] = [];
                let transMinX = Number.MAX_VALUE, transMaxX = Number.MIN_VALUE;
                let transMinY = Number.MAX_VALUE, transMaxY = Number.MIN_VALUE;
                let transMinZ = Number.MAX_VALUE, transMaxZ = Number.MIN_VALUE;

                for(const atom of chunkAtoms){
                    translations.push(atom.x, atom.y, atom.z);
                    transMinX = Math.min(transMinX, atom.x);
                    transMaxX = Math.max(transMaxX, atom.x);
                    transMinY = Math.min(transMinY, atom.y);
                    transMaxY = Math.max(transMaxY, atom.y);
                    transMinZ = Math.min(transMinZ, atom.z);
                    transMaxZ = Math.max(transMaxZ, atom.z);
                }

                const translationBufferSize = translations.length * 4;
                const currentBufferSize = bufferSize;
                const translationBufferOffset = currentBufferSize;

                const newBufferSize = currentBufferSize + translationBufferSize;
                const newArrayBuffer = new ArrayBuffer(newBufferSize);

                new Uint8Array(newArrayBuffer).set(new Uint8Array(arrayBuffer));

                const translationView = new Float32Array(newArrayBuffer, translationBufferOffset, translations.length);
                translationView.set(translations);

                arrayBuffer = newArrayBuffer;
                bufferSize = newBufferSize;

                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: translationBufferOffset,
                    byteLength: translationBufferSize,
                    target: 34962
                });

                const translationAccessorIndex = gltf.accessors.length;
                gltf.accessors.push({
                    bufferView: gltf.bufferViews.length - 1,
                    byteOffset: 0,
                    componentType: 5126,
                    count: chunkAtoms.length,
                    type: "VEC3",
                    min: [transMinX, transMinY, transMinZ],
                    max: [transMaxX, transMaxY, transMaxZ]
                });

                const nodeName = chunks > 1 ?
                    `Atoms_Instanced_Type_${atomType}_Chunk_${chunk}` :
                    `Atoms_Instanced_Type_${atomType}`;

                gltf.nodes.push({
                    name: nodeName,
                    mesh: gltf.meshes.length - 1,
                    extensions: {
                        EXT_mesh_gpu_instancing: {
                            attributes: { TRANSLATION: translationAccessorIndex }
                        }
                    }
                });

                gltf.scenes[0].nodes.push(gltf.nodes.length - 1);
            }

            currentMeshIndex++;
        }

        const encodedBuffer = this.arrayToBase64(arrayBuffer);
        gltf.buffers.push({
            byteLength: arrayBuffer.byteLength,
            uri: `data:application/octet-stream;base64,${encodedBuffer}`
        });

        gltf.extras = {
            originalAtomCount: frame.atoms.length,
            exportedAtomCount: selectedAtoms.length,
            sphereResolution: [segments, rings],
            timestep: frame.timestepInfo.timestep,
            finalAtomRadius: finalRadius,
            performanceProfile: {
                reductionRatio:(1 - selectedAtoms.length / frame.atoms.length),
                optimizationsApplied: [
                    'optimized_sphere_resolution'
                ].filter(Boolean)
            },
            optimizationSettings: {
                maxAtoms: opts.maxAtoms,
                maxInstancesPerMesh: opts.maxInstancesPerMesh
            }
        };

        fs.writeFileSync(outputFilePath, JSON.stringify(gltf, null, 2));
        console.log(`Exported GLTF: ${outputFilePath}`);
        console.log(`Buffer size: ${(arrayBuffer.byteLength /(1024 * 1024)).toFixed(2)} MB`)
    }

    public exportAtomsTypeToGLTF(
        atomsByType: AtomsGroupedByType,
        outputFilePath: string,
        options: GLTFExportOptions = {}
    ): void{
        const totalAtomCount = Object.values(atomsByType).reduce((sum, atoms) => sum + atoms.length, 0);

        const allAtomsForRadiusCalc = Object.values(atomsByType).flat().map(a => ({
            x: a.pos[0], y: a.pos[1], z: a.pos[2],
            id: a.id, type: 0, typeName: '' 
        }));
        const autoRadius = LAMMPSToGLTFExporter.calculateOptimalRadius(allAtomsForRadiusCalc);

        const opts: Required<GLTFExportOptions> = {
            atomRadius: options.atomRadius ?? autoRadius,
            maxAtoms: options.maxAtoms ?? 0,
            maxInstancesPerMesh: options.maxInstancesPerMesh ?? 10000
        };

        console.log(`Using atom radius: ${opts.atomRadius.toFixed(3)}(${options.atomRadius ? 'specified' : 'auto-detected'})`);
        const profile = LAMMPSToGLTFExporter.detectPerfomanceProfile(totalAtomCount);

        const finalRadius = opts.atomRadius;
        const { segments, rings } = profile.sphereResolution;
    
        const sphere = this.generateSphere(finalRadius, segments, rings);
        console.log(`Exporting ${totalAtomCount.toLocaleString()} atoms.`);
        console.log(`Atom final radius: ${finalRadius.toFixed(3)}`);

        const gltf: any = {
            asset: {
                version: '2.0',
                generator: 'OpenDXA Lammps GLTF Exporter',
                copyright: 'https://github.com/rodyherrera/OpenDXA'
            },
            extensionsUsed: ['EXT_mesh_gpu_instancing'],
            extensionsRequired: ['EXT_mesh_gpu_instancing'],
            scene: 0,
            scenes: [{ nodes: [] }],
            nodes: [],
            meshes: [],
            materials: [],
            accessors: [],
            bufferViews: [],
            buffers: []
        };

        const vertexBufferSize = sphere.vertices.length * 4;
        const indexBufferSize = sphere.indices.length * 2;
        const alignedIndexBufferOffset = Math.ceil(vertexBufferSize / 4) * 4;
        let bufferSize = alignedIndexBufferOffset + indexBufferSize;
        let arrayBuffer = new ArrayBuffer(bufferSize);

        new Float32Array(
            arrayBuffer,
            0,
            sphere.vertices.length
        ).set(sphere.vertices);

        new Uint16Array(
            arrayBuffer,
            alignedIndexBufferOffset,
            sphere.indices.length
        ).set(sphere.indices);

        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: 0,
            byteLength: vertexBufferSize,
            byteStride: 24,
            target: 34962
        });

        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: alignedIndexBufferOffset,
            byteLength: indexBufferSize,
            target: 34963
        });

        gltf.accessors.push({
            bufferView: 0,
            byteOffset: 0,
            componentType: 5126,
            count: sphere.vertices.length / 6,
            type: 'VEC3',
            min: sphere.bounds.min,
            max: sphere.bounds.max
        });

        gltf.accessors.push({
            bufferView: 0,
            byteOffset: 12,
            componentType: 5126,
            count: sphere.vertices.length / 6,
            type: 'VEC3'
        });

        gltf.accessors.push({
            bufferView: 1,
            byteOffset: 0,
            componentType: 5123,
            count: sphere.indices.length,
            type: 'SCALAR'
        });

        let materialIndex = 0;
        for(const [typeName, typeAtoms] of Object.entries(atomsByType)){
            if(typeAtoms.length === 0) continue;
            console.log(`Processing ${typeAtoms.length.toLocaleString()} atoms of type "${typeName}".`);

            const colorRGB = this.STRUCTURE_COLORS[typeName] || this.STRUCTURE_COLORS['Default'];
            gltf.materials.push({
                name: `Material_Type_${typeName}`,
                pbrMetallicRoughness: {
                    baseColorFactor: [...colorRGB, 1.0],
                    metallicFactor: 0.1,
                    roughnessFactor: 0.8
                }
            });

            const chunks = Math.ceil(typeAtoms.length / opts.maxInstancesPerMesh);
            for(let i = 0; i < chunks; i++){
                const chunkAtoms = typeAtoms.slice(i * opts.maxInstancesPerMesh,(i + 1) * opts.maxInstancesPerMesh);
                const translations = chunkAtoms.flatMap(a => a.pos); 

                const translationBufferOffset = bufferSize;
                const translationBufferSize = translations.length * 4;
                const newArrayBuffer = new ArrayBuffer(bufferSize + translationBufferSize);
                new Uint8Array(newArrayBuffer).set(new Uint8Array(arrayBuffer));
                new Float32Array(newArrayBuffer, translationBufferOffset, translations.length).set(translations);
                arrayBuffer = newArrayBuffer;
                bufferSize += translationBufferSize;

                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: translationBufferOffset,
                    byteLength: translationBufferSize,
                    target: 34962
                });

                const translationAccessorIndex = gltf.accessors.length;

                gltf.accessors.push({
                    bufferView: gltf.bufferViews.length - 1,
                    byteOffset: 0,
                    componentType: 5126,
                    count: chunkAtoms.length,
                    type: 'VEC3'
                });

                const meshIndex = gltf.meshes.length;
                gltf.meshes.push({
                    primitives: [{
                        attributes: {
                            POSITION: 0,
                            NORMAL: 1
                        },
                        indices: 2,
                        material: materialIndex,
                        mode: 4
                    }]
                });

                const nodeIndex = gltf.nodes.length;
                gltf.nodes.push({
                    mesh: meshIndex,
                    extensions: {
                        EXT_mesh_gpu_instancing: {
                            attributes: {
                                TRANSLATION: translationAccessorIndex
                            }
                        }
                    }
                });

                gltf.scenes[0].nodes.push(nodeIndex);
            }

            materialIndex++;
        }

        const encodedBuffer = this.arrayToBase64(arrayBuffer);
        gltf.buffers.push({
            byteLength: arrayBuffer.byteLength,
            uri: `data:application/octet-stream;base64,${encodedBuffer}`
        });

        fs.writeFileSync(outputFilePath, JSON.stringify(gltf));

        console.log(`GLTF successfully exported to: ${outputFilePath}`);
        console.log(`Buffer size: ${(arrayBuffer.byteLength /(1024 * 1024)).toFixed(2)} MB`);
    }
};

export default LAMMPSToGLTFExporter;