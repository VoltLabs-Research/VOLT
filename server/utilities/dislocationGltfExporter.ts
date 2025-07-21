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

import * as fs from 'fs';

export interface Dislocation {
    metadata: {
        type: string;
        count: number;
    };
    data: {
        index: number;
        type: string;
        point_index_offset: number;
        num_points: number;
        length: number;
        points: [number, number, number][];
        burgers: {
            vector: [number, number, number];
            magnitude: number;
            fractional: string;
        };
        junction_info?: {
            forward_node_dangling: boolean;
            backward_node_dangling: boolean;
            junction_arms_count: number;
            forms_junction: boolean;
        };
        core_sizes?: number[];
        average_core_size?: number;
        is_closed_loop?: boolean;
        is_infinite_line?: boolean;
        segment_id?: number;
        line_direction?: {
            vector: [number, number, number];
            string: string;
        };
        nodes?: {
            forward: any;
            backward: any;
        };
    }[];
    summary: {
        total_points: number;
        average_segment_length: number;
        max_segment_length: number;
        min_segment_length: number;
        total_length: number;
    };
}

export interface DislocationExportOptions {
    lineWidth?: number;
    tubularSegments?: number;
    material?: {
        baseColor?: [number, number, number, number];
        metallic?: number;
        roughness?: number;
        emissive?: [number, number, number];
    };
    colorByType?: boolean;
    typeColors?: Record<string, [number, number, number, number]>;
    metadata?: {
        includeOriginalStats?: boolean;
        customProperties?: Record<string, any>;
    };
}

interface DislocationValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    stats: object;
}

interface ProcessedDislocationGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    vertexCount: number;
    triangleCount: number;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

class DislocationExporter{
    private validate(dislocationData: Dislocation): DislocationValidationResult{
        const { data, metadata } = dislocationData;
        const errors: string[] = [];
        const warnings: string[] = [];

        if(!data || data.length === 0){
            warnings.push('No dislocation segments found. An empty file will be generated.');
        }

        if(metadata.count !== data.length){
            warnings.push(`Metadata count (${metadata.count}) doesn't match actual data length (${data.length}).`);
        }

        let emptySegments = 0;
        for(let i = 0; i < data.length; i++){
            const segment = data[i];
            if(!segment.points || segment.points.length < 2){
                emptySegments++;
                continue;
            }

            // Validate point coordinates
            for(let j = 0; j < segment.points.length; j++){
                const point = segment.points[j];
                if(point.length !== 3 || point.some((coord) => !isFinite(coord))){
                    errors.push(`Segment ${i}, point ${j} has invalid coordinates.`);
                }
            }
        }

        if(emptySegments > 0){
            warnings.push(`Found ${emptySegments} segments with less than 2 points.`);
        }

        return { isValid: errors.length === 0, errors, warnings, stats: {} };
    }

    private calculateBounds(points: [number, number, number][]): {
        min: [number, number, number];
        max: [number, number, number];
    }{
        if(points.length === 0){
            return { min: [0, 0, 0], max: [0, 0, 0] };
        }

        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

        for(const point of points){
            for(let i = 0; i < 3; i++){
                min[i] = Math.min(min[i], point[i]);
                max[i] = Math.max(max[i], point[i]); 
            }
        }

        return { min, max };
    }

    private createLineGeometry(
        points: [number, number, number][],
        lineWidth: number,
        tubularSegments: number = 8
    ): { positions: number[]; normals: number[]; indices: number[] }{
        if(points.length < 2){
            return { positions: [], normals: [], indices: [] };
        }

        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];

        // Generate tubular geometry around the line
        for(let i = 0; i < points.length - 1; i++){
            const p1 = points[i];
            const p2 = points[i + 1];

            // Calculate direction vector
            const dir = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
            const length = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
            
            if(length < 1e-6) continue;

            // Normalize direction
            dir[0] /= length;
            dir[1] /= length;
            dir[2] /= length;

            // Find perpendicular vectors
            let up = [0, 1, 0];
            if(Math.abs(dir[1]) > 0.99){
                up = [1, 0, 0];
            }

            // Right vector (cross product)
            const right = [
                dir[1] * up[2] - dir[2] * up[1],
                dir[2] * up[0] - dir[0] * up[2],
                dir[0] * up[1] - dir[1] * up[0]
            ];

            // Normalize right
            const rightLength = Math.sqrt(right[0] * right[0] + right[1] * right[1] + right[2] * right[2]);
            right[0] /= rightLength;
            right[1] /= rightLength;
            right[2] /= rightLength;

            // Up vector (cross product of dir and right)
            up = [
                dir[1] * right[2] - dir[2] * right[1],
                dir[2] * right[0] - dir[0] * right[2],
                dir[0] * right[1] - dir[1] * right[0]
            ];

            const baseVertexIndex = positions.length / 3;

            // Generate vertices around the circle
            for(let j = 0; j <= tubularSegments; j++){
                const angle = (j / tubularSegments) * Math.PI * 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                const radius = lineWidth * 0.5;
                const offset = [
                    (right[0] * cos + up[0] * sin) * radius,
                    (right[1] * cos + up[1] * sin) * radius,
                    (right[2] * cos + up[2] * sin) * radius
                ];

                // Add vertices for both ends of the segment
                positions.push(p1[0] + offset[0], p1[1] + offset[1], p1[2] + offset[2]);
                positions.push(p2[0] + offset[0], p2[1] + offset[1], p2[2] + offset[2]);

                // Add normals (pointing outward from the line)
                const normalLength = Math.sqrt(offset[0] * offset[0] + offset[1] * offset[1] + offset[2] * offset[2]);
                if(normalLength > 1e-6){
                    const nx = offset[0] / normalLength;
                    const ny = offset[1] / normalLength;
                    const nz = offset[2] / normalLength;
                    normals.push(nx, ny, nz);
                    normals.push(nx, ny, nz);
                }else{
                    normals.push(0, 1, 0);
                    normals.push(0, 1, 0);
                }
            }

            // Generate indices for the tube
            for(let j = 0; j < tubularSegments; j++){
                const v1 = baseVertexIndex + j * 2;
                const v2 = baseVertexIndex + j * 2 + 1;
                const v3 = baseVertexIndex + (j + 1) * 2;
                const v4 = baseVertexIndex + (j + 1) * 2 + 1;
                
                // Two triangles per quad
                indices.push(v1, v2, v3);
                indices.push(v3, v2, v4);
            }
        }

        return { positions, normals, indices };
    }

    private getDefaultTypeColors(): Record<string, [number, number, number, number]> {
        return {
            // Green
            'edge': [0.0, 1.0, 0.0, 1.0],
            // Red
            'screw': [1.0, 0.0, 0.0, 1.0],
            // Blue
            'mixed': [0.0, 0.0, 1.0, 1.0],
            // Yellow
            'partial': [1.0, 1.0, 0.0, 1.0],
            // Gray
            'default': [0.5, 0.5, 0.5, 1.0]
        };
    }

    private processGeometry(
        dislocationData: Dislocation,
        options: Required<DislocationExportOptions>
    ): ProcessedDislocationGeometry{
        const { data } = dislocationData;
        console.log(`Processing ${data.length} dislocation segments...`);
        
        let allPositions: number[] = [];
        let allNormals: number[] = [];
        let allIndices: number[] = [];
        let allColors: number[] = [];

        const typeColors = options.colorByType ? 
            { ...this.getDefaultTypeColors(), ...options.typeColors } :
            this.getDefaultTypeColors();

        let currentVertexOffset = 0;
        let validSegments = 0;
        
        for(const segment of data){
            if(!segment.points || segment.points.length < 2){
                continue;
            }

            validSegments++;
            let geometry;

            geometry = this.createLineGeometry(
                segment.points,
                options.lineWidth,
                options.tubularSegments
            );

            if(geometry.positions.length === 0) continue;

            // Add positions and normals
            allPositions.push(...geometry.positions);
            allNormals.push(...geometry.normals);

            // Add colors if color by type is enabled
            if(options.colorByType){
                const color = typeColors[segment.type] || typeColors['default'];
                const vertexCount = geometry.positions.length / 3;
                for(let i = 0; i < vertexCount; i++){
                    allColors.push(...color);
                }
            }

            // Add indices with offset
            for(const index of geometry.indices){
                allIndices.push(index + currentVertexOffset);
            }

            currentVertexOffset += geometry.positions.length / 3;
        }

        console.log(`Processed ${validSegments} valid segments.`);

        const positions = new Float32Array(allPositions);
        const normals = new Float32Array(allNormals);
        const indices = new Uint32Array(allIndices);
        const colors = options.colorByType ? new Float32Array(allColors) : undefined;

        // Calculate bounds
        const allPoints: [number, number, number][] = [];
        for(let i = 0; i < positions.length; i += 3){
            allPoints.push([positions[i], positions[i + 1], positions[i + 2]]);
        }

        const bounds = this.calculateBounds(allPoints);

        return {
            positions,
            normals,
            indices,
            colors,
            vertexCount: positions.length / 3,
            triangleCount: indices.length / 3,
            bounds
        };
    }

    private createGLTF(
        geometry: ProcessedDislocationGeometry,
        options: Required<DislocationExportOptions>
    ): any{
        const positionBufferSize = geometry.positions.byteLength;
        const normalBufferSize = geometry.normals.byteLength;
        const colorBufferSize = geometry.colors ? geometry.colors.byteLength : 0;
        const indexBufferSize = geometry.indices.byteLength;

        const positionOffset = 0;
        const normalOffset = positionBufferSize;
        const colorOffset = normalOffset + normalBufferSize;
        const indexOffset = colorOffset + colorBufferSize;
        const totalBufferSize = indexOffset + indexBufferSize;

        const arrayBuffer = new ArrayBuffer(totalBufferSize);

        // Copy data to buffer
        new Float32Array(
            arrayBuffer,
            positionOffset,
            geometry.positions.length
        ).set(geometry.positions);

        new Float32Array(
            arrayBuffer,
            normalOffset,
            geometry.normals.length
        ).set(geometry.normals);

        if(geometry.colors){
            new Float32Array(
                arrayBuffer,
                colorOffset,
                geometry.colors.length
            ).set(geometry.colors);
        }

        if(geometry.indices.length > 0){
            new Uint32Array(
                arrayBuffer,
                indexOffset,
                geometry.indices.length
            ).set(geometry.indices)
        }

        const gltf: any = {
            asset: {
                version: '2.0',
                generator: 'OpenDXA Dislocation Exporter',
                copyright: 'https://github.com/rodyherrera/OpenDXA'
            },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ name: 'Dislocations', mesh: 0 }],
            materials: [{
                name: 'DislocationMaterial',
                pbrMetallicRoughness: {
                    baseColorFactor: options.material.baseColor,
                    metallicFactor: options.material.metallic,
                    roughnessFactor: options.material.roughness,
                },
                emissiveFactor: options.material.emissive,
                doubleSided: true
            }],
            meshes: [],
            accessors: [{
                // Position
                bufferView: 0,
                componentType: 5126,
                count: geometry.vertexCount,
                type: 'VEC3',
                min: geometry.bounds.min,
                max: geometry.bounds.max
            }, {
                // Normal
                bufferView: 1,
                componentType: 5126,
                count: geometry.vertexCount,
                type: 'VEC3'
            }],
            bufferViews: [{
                // ARRAY_BUFFER (Positions)
                buffer: 0,
                byteOffset: positionOffset,
                byteLength: positionBufferSize,
                target: 34962
            }, {
                // ARRAY_BUFFER (Normals)
                buffer: 0,
                byteOffset: normalOffset,
                byteLength: normalBufferSize,
                target: 34962
            }],
            buffers: [{
                byteLength: totalBufferSize,
                uri: `data:application/octet-stream;base64,${this.arrayToBase64(arrayBuffer)}`
            }],
           extras: options.metadata.includeOriginalStats ? {
                stats: {
                    vertexCount: geometry.vertexCount,
                    triangleCount: geometry.triangleCount,
                    segmentCount: geometry.triangleCount / (options.tubularSegments * 2)
                },
                ...options.metadata.customProperties,
            } : options.metadata.customProperties
        };

        // Add color accessor and buffer view if colors are present
        if(geometry.colors){
            gltf.accessors.push({
                bufferView: 2,
                componentType: 5126,
                count: geometry.vertexCount,
                type: 'VEC4'
            });

            gltf.bufferViews.push({
                buffer: 0,
                byteOffset: colorOffset,
                byteLength: colorBufferSize,
                target: 34962
            });
        }

        // Add mesh primitive if there's geometry to render
        if(geometry.indices.length > 0){
            const attributes: any = { POSITION: 0, NORMAL: 1 };
            let accessorIndex = 2;

            if(geometry.colors){
                attributes.COLOR_0 = accessorIndex++;
            }

            gltf.meshes.push({
                name: 'DislocationGeometry',
                primitives: [{
                    attributes,
                    indices: accessorIndex,
                    material: 0,
                    // 4 = TRIANGLES
                    mode: 4
                }]
            });

            // Add index accessor
            gltf.accessors.push({
                bufferView: geometry.colors ? 3 : 2,
                componentType: 5125,
                count: geometry.indices.length,
                type: 'SCALAR'
            });

            // Add index buffer view
            gltf.bufferViews.push({
                buffer: 0,
                byteOffset: indexOffset,
                byteLength: indexBufferSize,
                target: 34963
            });
        }

        return gltf;
    }

    private arrayToBase64(array: ArrayBuffer): string {
        return Buffer.from(array).toString('base64');
    }

    public toGLTF(
        dislocationData: Dislocation,
        outputFilePath: string,
        options: DislocationExportOptions = {}
    ): void{
        const opts: Required<DislocationExportOptions> = {
            lineWidth: options.lineWidth ?? 0.1,
            tubularSegments: options.tubularSegments ?? 8,
            material: {
                baseColor: options.material?.baseColor ?? [1.0, 0.5, 0.0, 1.0],
                metallic: options.material?.metallic ?? 0.0,
                roughness: options.material?.roughness ?? 0.8,
                emissive: options.material?.emissive ?? [0.0, 0.0, 0.0],
            },
            colorByType: options.colorByType ?? true,
            typeColors: options.typeColors ?? {},
            metadata: {
                includeOriginalStats: options.metadata?.includeOriginalStats ?? true,
                customProperties: options.metadata?.customProperties ?? {},
            }
        };

        console.log('Starting dislocation export...');

        const validation = this.validate(dislocationData);

        if(!validation.isValid){
            console.error('Validation failed:', validation.errors);
            throw new Error(`Invalid dislocation data: ${validation.errors.join(', ')}`);
        }
        
        if(validation.warnings.length > 0){
            console.warn('Validation warnings:', validation.warnings);
        }

        const processedGeometry = this.processGeometry(dislocationData, opts);
        const gltf = this.createGLTF(processedGeometry, opts);
        
        fs.writeFileSync(outputFilePath, JSON.stringify(gltf, null, 2));

        console.log(`Dislocations successfully exported to: ${outputFilePath}`);
        console.log(`Final statistics: ${processedGeometry.triangleCount} triangles, ${processedGeometry.vertexCount} vertices.`);
        console.log(`Segments processed: ${dislocationData.data.length}`);

        const bufferSizeMB = (gltf.buffers[0].byteLength / (1024 * 1024)).toFixed(2);
        console.log(`Buffer size: ${bufferSizeMB} MB`);
    }
};

export default DislocationExporter;