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

import Dislocation from '@/models/dislocations';
import { 
    DislocationExportOptions, 
    ProcessedDislocationGeometry 
} from '@/types/utilities/export/dislocations';
import { calculateDislocationType } from '@/utilities/dislocation-utils';
import { assembleAndWriteGLB } from '@/utilities/export/utils';

class DislocationExporter{
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
            'Other': [0.95, 0.1, 0.1, 1.0],
            '1/2<111>': [0.1, 0.9, 0.1, 1.0],
            '<100>': [1, 0.45, 0.74, 1.0],
            '<110>': [0.1, 0.7, 0.95, 1.0],
            '<111>': [0.95, 0.9, 0.1, 1.0],
            '1/6<112>': [0.9, 0.5, 0.1, 1.0],
        };
    }
        
    private processGeometry(
        dislocationData: any,
        options: Required<DislocationExportOptions>
    ): ProcessedDislocationGeometry {
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
        
        const typeStats: Record<string, number> = {};
        
        for(const segment of data){
            if(!segment.points || segment.points.length < options.minSegmentPoints){
                continue;
            }

            validSegments++;
            
            const calculatedType = calculateDislocationType(segment);
            segment.type = calculatedType;
            
            typeStats[calculatedType] = (typeStats[calculatedType] || 0) + 1;

            let geometry = this.createLineGeometry(
                segment.points,
                options.lineWidth,
                options.tubularSegments
            );

            if(geometry.positions.length === 0) continue;

            allPositions.push(...geometry.positions);
            allNormals.push(...geometry.normals);

            if(options.colorByType){
                const color = typeColors[calculatedType] || typeColors['default'];
                const vertexCount = geometry.positions.length / 3;
                for(let i = 0; i < vertexCount; i++){
                    allColors.push(...color);
                }
            }

            for(const index of geometry.indices){
                allIndices.push(index + currentVertexOffset);
            }

            currentVertexOffset += geometry.positions.length / 3;
        }

        console.log(`Processed ${validSegments} valid segments.`);
        console.log('Dislocation type distribution:', typeStats);

        const positions = new Float32Array(allPositions);
        const normals = new Float32Array(allNormals);
        const indices = new Uint32Array(allIndices);
        const colors = options.colorByType ? new Float32Array(allColors) : undefined;

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

    private createGLB(
        geometry: ProcessedDislocationGeometry,
        options: Required<DislocationExportOptions>,
        outputFilePath: string
    ): any {
        const useU16 = geometry.vertexCount > 0 && geometry.vertexCount <= 65535;
        const indicesArray = useU16
            ? new Uint16Array(geometry.indices)
            : geometry.indices;
        
        // 5123 = UNSIGNED_SHORT; 5125 = UNSIGNED INT
        const indexComponentType = useU16 ? 5123  : 5125;

        // Float32Array
        const positionBufferSize = geometry.positions.byteLength;
        const normalBufferSize = geometry.normals.byteLength;
        const colorBufferSize = geometry.colors ? geometry.colors.byteLength : 0;
        // Uint16 or Uint32
        const indexBufferSize = indicesArray.byteLength;

        const positionOffset = 0;
        const normalOffset = positionOffset + positionBufferSize;
        const colorOffset = normalOffset + normalBufferSize;
        const indexOffset = colorOffset + colorBufferSize;
        const totalBufferSize = indexOffset + indexBufferSize;

        const arrayBuffer = new ArrayBuffer(totalBufferSize);

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

        if(useU16){
            new Uint16Array(
                arrayBuffer, 
                indexOffset, 
                indicesArray.length
            ).set(indicesArray as Uint16Array);
        }else{
            new Uint32Array(
                arrayBuffer, 
                indexOffset, 
                indicesArray.length
            ).set(indicesArray as Uint32Array);
        }

        const glb: any = {
            asset: {
                version: '2.0',
                generator: 'OpenDXA Dislocation Exporter',
                copyright: 'https://github.com/rodyherrera/OpenDXA'
            },
            scene: 0,
            scenes: [{ nodes: [] }],
            nodes: [],
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
            accessors: [],
            bufferViews: [],
            buffers: [{ byteLength: totalBufferSize }],
            extras: options.metadata.includeOriginalStats ? {
            stats: {
                vertexCount: geometry.vertexCount,
                triangleCount: geometry.triangleCount,
                segmentCount: geometry.triangleCount / (options.tubularSegments * 2)
            },
            ...options.metadata.customProperties,
            } : options.metadata.customProperties
        };

        if(geometry.vertexCount === 0 || indicesArray.length === 0){
            assembleAndWriteGLB(glb, arrayBuffer, outputFilePath);
            return;
        }

        // POSITION
        const bvPosition = glb.bufferViews.length;
        glb.bufferViews.push({
            buffer: 0,
            byteOffset: positionOffset,
            byteLength: positionBufferSize,
            // ARRAY_BUFFER
            target: 34962
        });
        const accPosition = glb.accessors.length;
        glb.accessors.push({
            bufferView: bvPosition,
            // FLOAT
            componentType: 5126, 
            count: geometry.vertexCount,
            type: 'VEC3',
            min: geometry.bounds.min,
            max: geometry.bounds.max
        });

        // NORMAL
        const bvNormal = glb.bufferViews.length;
        glb.bufferViews.push({
            buffer: 0,
            byteOffset: normalOffset,
            byteLength: normalBufferSize,
            // ARRAY_BUFFER
            target: 34962 
        });
        const accNormal = glb.accessors.length;
        glb.accessors.push({
            bufferView: bvNormal,
            // FLOAT
            componentType: 5126, 
            count: geometry.vertexCount,
            type: 'VEC3'
        });

        // COLOR_0 
        let accColor: number | undefined;
        if (geometry.colors) {
            const bvColor = glb.bufferViews.length;
            glb.bufferViews.push({
                buffer: 0,
                byteOffset: colorOffset,
                byteLength: colorBufferSize,
                // ARRAY_BUFFER
                target: 34962
            });
            accColor = glb.accessors.length;
            glb.accessors.push({
                bufferView: bvColor,
                // FLOAT
                componentType: 5126, 
                count: geometry.vertexCount,
                type: 'VEC4'
            });
        }

        // INDICES
        const bvIndices = glb.bufferViews.length;
        glb.bufferViews.push({
            buffer: 0,
            byteOffset: indexOffset,
            byteLength: indexBufferSize,
            // ELEMENT_ARRAY_BUFFER
            target: 34963 
        });
        const accIndices = glb.accessors.length;
        glb.accessors.push({
            bufferView: bvIndices,
            componentType: indexComponentType,
            count: indicesArray.length,
            type: 'SCALAR'
        });

        const attributes: Record<string, number> = {
            POSITION: accPosition,
            NORMAL: accNormal
        };

        if(accColor !== undefined){
            attributes.COLOR_0 = accColor;
        }

        glb.meshes.push({
            name: 'DislocationGeometry',
            primitives: [{
                attributes,
                indices: accIndices,
                material: 0,
                // TRIANGLES
                mode: 4
            }]
        });

        const nodeIndex = glb.nodes.length;
        glb.nodes.push({
            name: 'Dislocations',
            mesh: 0
        });
        glb.scenes[0].nodes.push(nodeIndex);

        assembleAndWriteGLB(glb, arrayBuffer, outputFilePath);
    }

    public async rebuildGLBFromDB(
        analysisConfigId: string,
        timestep: number,
        trajectoryId: string,
        outputFilePath: string,
        options: DislocationExportOptions = {}
    ): Promise<void> {
        try {
            console.log(`[DislocationExporter] Rebuilding GLB from DB for timestep ${timestep}...`);

            const dislocationDoc = await Dislocation.findOne({
                analysisConfig: analysisConfigId,
                timestep: timestep,
                trajectory: trajectoryId
            }).lean();

            if (!dislocationDoc) {
                throw new Error(`No dislocation data found for timestep ${timestep}, analysisConfig ${analysisConfigId}, trajectory ${trajectoryId}`);
            }


            const dislocationData = this.convertDBDataToDislocationFormat(dislocationDoc);

            const opts: Required<DislocationExportOptions> = {
                lineWidth: options.lineWidth ?? 0.08,
                tubularSegments: options.tubularSegments ?? 12,
                minSegmentPoints: options.minSegmentPoints ?? 2, 
                material: {
                    baseColor: options.material?.baseColor ?? [1.0, 1.0, 1.0, 1.0], 
                    metallic: options.material?.metallic ?? 0.1,
                    roughness: options.material?.roughness ?? 0.3, 
                    emissive: options.material?.emissive ?? [0.0, 0.0, 0.0],
                },
                colorByType: options.colorByType ?? true, 
                typeColors: options.typeColors ?? {},
                metadata: {
                    includeOriginalStats: options.metadata?.includeOriginalStats ?? true,
                    customProperties: options.metadata?.customProperties ?? {},
                }
            };

            const processedGeometry = this.processGeometry(dislocationData, opts);
            this.createGLB(processedGeometry, opts, outputFilePath);

            console.log(`[DislocationExporter] GLB successfully rebuilt and saved to: ${outputFilePath}`);
            console.log(`[DislocationExporter] Statistics: ${processedGeometry.triangleCount} triangles, ${processedGeometry.vertexCount} vertices`);

        } catch (error) {
            console.error(`[DislocationExporter] Failed to rebuild GLB from DB:`, error);
            throw error;
        }
    }

    private convertDBDataToDislocationFormat(dbData: any): any {
        const dislocationSegments = dbData.dislocations.map((segment: any) => ({
            segment_id: segment.segmentId,
            type: segment.type,
            num_points: segment.numPoints,
            length: segment.length,
            points: segment.points,
            burgers: {
                vector: segment.burgers.vector,
                magnitude: segment.burgers.magnitude,
                fractional: segment.burgers.fractional
            },
            nodes: segment.nodes,
            line_direction: segment.lineDirection ? {
                vector: segment.lineDirection.vector || [0, 0, 0],
                string: segment.lineDirection.string || ''
            } : {
                vector: [0, 0, 0],
                string: ''
            }
        }));

        return {
            data: dislocationSegments,
            metadata: {
                count: dbData.totalSegments,
                timestep: dbData.timestep,
                trajectoryId: dbData.trajectory.toString(),
                analysisConfigId: dbData.analysisConfig.toString()
            },
            summary: {
                total_points: dbData.totalPoints,
                average_segment_length: dbData.averageSegmentLength,
                max_segment_length: dbData.maxSegmentLength,
                min_segment_length: dbData.minSegmentLength,
                total_length: dbData.totalLength
            }
        };
    }
        
    public toGLB(
        dislocationData: any,
        outputFilePath: string,
        options: DislocationExportOptions = {}
    ): void {
        const opts: Required<DislocationExportOptions> = {
            lineWidth: options.lineWidth ?? 0.08,
            tubularSegments: options.tubularSegments ?? 12,
            minSegmentPoints: options.minSegmentPoints ?? 2,
            material: {
                baseColor: options.material?.baseColor ?? [1.0, 1.0, 1.0, 1.0], 
                metallic: options.material?.metallic ?? 0.1,
                roughness: options.material?.roughness ?? 0.3,
                emissive: options.material?.emissive ?? [0.0, 0.0, 0.0],
            },
            colorByType: options.colorByType ?? true,
            typeColors: options.typeColors ?? {},
            metadata: {
                includeOriginalStats: options.metadata?.includeOriginalStats ?? true,
                customProperties: options.metadata?.customProperties ?? {},
            }
        };

        console.log('Starting dislocation export with automatic type calculation...');

        const processedGeometry = this.processGeometry(dislocationData, opts);
        this.createGLB(processedGeometry, opts, outputFilePath);
        
        console.log(`Dislocations successfully exported to: ${outputFilePath}`);
        console.log(`Final statistics: ${processedGeometry.triangleCount} triangles, ${processedGeometry.vertexCount} vertices.`);
        console.log(`Segments processed: ${dislocationData.data.length}`);
    }
};

export default DislocationExporter;
