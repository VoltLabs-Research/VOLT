import * as fs from 'fs';
import { TimestepInfo, Atom } from './lammps';

export interface GLTFExportOptions{
    atomRadius?: number;
    spatialCulling?: boolean;
    cullCenter?: { x: number; y: number; z: number };
    cullRadius?: number;
    subsampleRatio?: number;
    maxAtoms?: number;
    maxInstancesPerMesh?: number;
}

export interface ParsedFrame{
    timestepInfo: TimestepInfo;
    atoms: Atom[];
}

class LAMMPSToGLTFExporter{
    private lammpsTypeColors: Map<number, number[]> = new Map([
        // Gray
        [0, [0.5, 0.5, 0.5, 1.0]],
        // Red
        [1, [1.0, 0.267, 0.267, 1.0]],
        // Green
        [2, [0.267, 1.0, 0.267, 1.0]],
        // Blue
        [3, [0.267, 0.267, 1.0, 1.0]],
        // Yellow
        [4, [1.0, 1.0, 0.267, 1.0]], 
        // Magenta
        [5, [1.0, 0.267, 1.0, 1.0]],
        // Cyan
        [6, [0.267, 1.0, 1.0, 1.0]]
    ]);

    // Parse atoms from LAMMPS file lines
    private parseAtoms(lines: string[]): Atom[]{
        const atoms: Atom[] = [];
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

    // Parse complete frame from LAMMPS file
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

    // Apply spatial culling and subsampling to atoms
    private selectAtoms(atoms: Atom[], options: GLTFExportOptions): Atom[]{
        let selectedAtoms = [...atoms];

        // Spatial culling
        if(options.spatialCulling && options.cullCenter && options.cullRadius){
            selectedAtoms = selectedAtoms.filter((atom) => {
                const dx = atom.x - options.cullCenter!.x;
                const dy = atom.y - options.cullCenter!.y;
                const dz = atom.z - options.cullCenter!.z;

                const distanceSquared = dx * dx + dy * dy + dz * dz;
                return distanceSquared;
            });
        }

        // Subsampling
        if(options.subsampleRatio && options.subsampleRatio < 1.0 && selectedAtoms.length > 0){
            const shuffled = [...selectedAtoms].sort(() => Math.random() - 0.5);
            const targetCount = Math.floor(selectedAtoms.length * options.subsampleRatio);
            selectedAtoms = shuffled.slice(0, targetCount);
        }

        // Max atoms limit
        if(options.maxAtoms && selectedAtoms.length > options.maxAtoms){
            selectedAtoms = selectedAtoms.slice(0, options.maxAtoms);
        }

        return selectedAtoms;
    }

    // Generate sphere geometry
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

        // Generate vertices
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

                // Position
                vertices.push(x, y, z);

                // Normal
                const normLen = Math.sqrt(x * x + y * y + z * z);
                if(normLen > 0.0){
                    vertices.push(x / normLen, y / normLen, z / normLen);
                }else{
                    vertices.push(0, 1, 0);
                }
            }
        }

        // Generate indices
        for(let ring = 0; ring < rings; ring++){
            for(let segment = 0; segment < segments; segment++){
                const current = ring * (segments + 1) + segment;
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

    // Convert array to base64
    private arrayToBase64(array: ArrayBuffer): string{
        return Buffer.from(array).toString('base64');
    }

    // Export atoms to GLTF format
    exportAtomsToGLTF(
        filePath: string,
        outputFilePath: string,
        extractTimestepInfo: Function,
        options: GLTFExportOptions = {}
    ): void{
        // Default options
        const opts: Required<GLTFExportOptions> = {
            atomRadius: options.atomRadius ?? 0.5,
            spatialCulling: options.spatialCulling ?? false,
            cullCenter: options.cullCenter ?? { x: 0, y: 0, z: 0 },
            cullRadius: options.cullRadius ?? 10.0,
            subsampleRatio: options.subsampleRatio ?? 1.0,
            maxAtoms: options.maxAtoms ?? 0,
            maxInstancesPerMesh: options.maxInstancesPerMesh ?? 10000
        };

        // Parse frame
        const frame = this.parseFrame(filePath, extractTimestepInfo);
        const selectedAtoms = this.selectAtoms(frame.atoms, opts);

        console.log(`Exporting ${selectedAtoms.length} of ${frame.atoms.length} atoms (${(100.0 * selectedAtoms.length / frame.atoms.length).toFixed(1)}%)`);

        // Determine sphere solution based on atom acount
        let segments: number, rings: number;
        if(selectedAtoms.length > 100000){
            segments = 6;
            rings = 4;
        }else if(selectedAtoms.length > 10000){
            segments = 8;
            rings = 6;
        }else{
            segments = 12;
            rings = 8;
        }

        // Generate sphere geometry
        const sphere = this.generateSphere(opts.atomRadius, segments, rings);

        // Initialize GLTF structure
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

        // Calculate required buffer size
        // Float32 = 4 bytes
        const vertexBufferSize = sphere.vertices.length * 4;
        // Uint16 = 2 bytes
        const indexBufferSize = sphere.indices.length * 2;

        // Align index buffer to 4-byte boundary
        const vertexBufferOffset = 0
        const indexBufferOffset = vertexBufferSize;
        const alignedIndexBufferOffset = Math.ceil(indexBufferOffset / 4) * 4;

        // Create proper binary buffer
        let bufferSize = alignedIndexBufferOffset + indexBufferSize;

        // Create ArrayBuffer and views
        let arrayBuffer = new ArrayBuffer(bufferSize);
        const vertexView = new Float32Array(arrayBuffer, vertexBufferOffset, sphere.vertices.length);
        const indexView = new Uint16Array(arrayBuffer, alignedIndexBufferOffset, sphere.indices.length);

        // Copy data
        vertexView.set(sphere.vertices);
        indexView.set(sphere.indices);

        // Buffer views for sphere geometry
        gltf.bufferViews.push({
            buffer: 0,
            byteOffset: vertexBufferOffset,
            byteLength: vertexBufferSize,
            // 6 floats * 4 bytes (position + normal)
            byteStride: 24,
            // ARRAY_BUFFER
            target: 34962
        }, {
            buffer: 0,
            byteOffset: alignedIndexBufferOffset,
            byteLength: indexBufferSize,
            // ELEMENT_ARRAY_BUFFER
            target: 34963
        });

        // Accessors for sphere geometry
        gltf.accessors.push({
            bufferView: 0,
            byteOffset: 0,
            // FLOAT
            componentType: 5126,
            count: sphere.vertices.length / 6,
            type: 'VEC3',
            min: sphere.bounds.min,
            max: sphere.bounds.max
        }, {
            bufferView: 0,
            // 3 floats * 4 bytes
            byteOffset: 12,
            // FLOAT
            componentType: 5126,
            count: sphere.vertices.length / 6,
            type: 'VEC3',
            min: [-1.0, -1.0, -1.0],
            max: [1.0, 1.0, 1.0]
        }, {
            bufferView: 1,
            byteOffset: 0,
            // UNSIGNED_SHORT
            componentType: 5123,
            count: sphere.indices.length,
            type: 'SCALAR'
        });

        // Group atoms by type
        const atomsByType = new Map<number, Atom[]>();
        for(const atom of selectedAtoms){
            if(!atomsByType.has(atom.type)){
                atomsByType.set(atom.type, []);
            }
            atomsByType.get(atom.type)!.push(atom);
        }

        let currentMeshIndex = 0;

        // Process each atom type
        for(const [atomType, typeAtoms] of atomsByType){
            if(typeAtoms.length === 0) continue;
            // Create material for this type
            const color = this.lammpsTypeColors.get(atomType) || this.lammpsTypeColors.get(0)!;
            gltf.materials.push({
                name: `Material_LammpsType_${atomType}`,
                pbrMetallicRoughness: {
                    baseColorFactor: color,
                    metallicFactor: 0.1,
                    roughnessFactor: 0.8
                }
            });

            // Split into chunks if needed
            const totalAtoms = typeAtoms.length;
            const chunks = Math.max(1, Math.ceil(totalAtoms / opts.maxInstancesPerMesh));
            const atomsPerChunk = Math.ceil(totalAtoms / chunks);
            for(let chunk = 0; chunk < chunks; chunk++){
                const startIdx = chunk * atomsPerChunk;
                const endIdx = Math.min(startIdx + atomsPerChunk, totalAtoms);
                if(startIdx >= endIdx) break;

                const chunkAtoms = typeAtoms.slice(startIdx, endIdx);
                // Create mesh
                const meshName = chunks > 1 ? 
                    `AtomSphere_Type_${atomType}_Chunk_${chunk}` : 
                    `AtomSphere_Type_${atomType}`;

                gltf.meshes.push({
                    name: meshName,
                    primitives: [{
                        attributes: { POSITION: 0, NORMAL: 1 },
                        indices: 2,
                        material: currentMeshIndex,
                        // TRIANGLES
                        mode: 4
                    }]
                });

                // Create translation data
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

                // Calculate translation buffer properties
                const translationBufferSize = translations.length * 4;
                const currentBufferSize = bufferSize;
                const translationBufferOffset = currentBufferSize;

                // Extend the buffer to include translation data
                const newBufferSize = currentBufferSize + translationBufferSize;
                const newArrayBuffer = new ArrayBuffer(newBufferSize);

                // Copy existing data
                new Uint8Array(newArrayBuffer).set(new Uint8Array(arrayBuffer));

                // Add translation data
                const translationView = new Float32Array(newArrayBuffer, translationBufferOffset, translations.length);
                translationView.set(translations);

                // Update buffer reference
                arrayBuffer = newArrayBuffer;
                bufferSize = newBufferSize;

                gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: translationBufferOffset,
                    byteLength: translationBufferSize,
                    // ARRAY_BUFFER
                    target: 34962
                });

                const translationAccessorIndex = gltf.accessors.length;
                gltf.accessors.push({
                    bufferView: gltf.bufferViews.length - 1,
                    byteOffset: 0,
                    // FLOAT
                    componentType: 5126,
                    count: chunkAtoms.length,
                    type: "VEC3",
                    min: [transMinX, transMinY, transMinZ],
                    max: [transMaxX, transMaxY, transMaxZ]
                });

                // Create node
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

        // Create buffer with base64 encoding
        const encodedBuffer = this.arrayToBase64(arrayBuffer);
        gltf.buffers.push({
            byteLength: arrayBuffer.byteLength,
            uri: `data:application/octet-stream;base64,${encodedBuffer}`
        });

        // Add metadata
        gltf.extras = {
            originalAtomCount: frame.atoms.length,
            exportedAtomCount: selectedAtoms.length,
            sphereResolution: [segments, rings],
            timestep: frame.timestepInfo.timestep,
            optimizationSettings: {
                maxAtoms: opts.maxAtoms,
                subsampleRatio: opts.subsampleRatio,
                spatialCulling: opts.spatialCulling,
                maxInstancesPerMesh: opts.maxInstancesPerMesh
            }
        };

        // Write file
        fs.writeFileSync(outputFilePath, JSON.stringify(gltf, null, 2));
        console.log(`Exported GLTF: ${outputFilePath}`);
        console.log(`Buffer size: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`)
    }
};

export default LAMMPSToGLTFExporter;