/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import {
    DislocationExportOptions,
    ProcessedDislocationGeometry
} from '@/types/utilities/export/dislocations';
import { calculateDislocationType } from '@/utilities/dislocation-utils';
import { assembleGLBToBuffer } from '@/utilities/export/utils';
import { buildPrimitiveGLB } from '@/utilities/export/build-primitive';
import { computeBoundsFromPoints } from '@/utilities/export/bounds';
import { putObject, getObject } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';

class DislocationExporter {
    private createLineGeometry(
        points: [number, number, number][],
        lineWidth: number,
        tubularSegments: number = 8
    ): { positions: number[]; normals: number[]; indices: number[] } {
        if (points.length < 2) {
            return { positions: [], normals: [], indices: [] };
        }

        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];

        // Generate tubular geometry around the line
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Calculate direction vector
            const dir = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
            const length = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);

            if (length < 1e-6) continue;

            // Normalize direction
            dir[0] /= length;
            dir[1] /= length;
            dir[2] /= length;

            // Find perpendicular vectors
            let up = [0, 1, 0];
            if (Math.abs(dir[1]) > 0.99) {
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
            for (let j = 0; j <= tubularSegments; j++) {
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
                if (normalLength > 1e-6) {
                    const nx = offset[0] / normalLength;
                    const ny = offset[1] / normalLength;
                    const nz = offset[2] / normalLength;
                    normals.push(nx, ny, nz);
                    normals.push(nx, ny, nz);
                } else {
                    normals.push(0, 1, 0);
                    normals.push(0, 1, 0);
                }
            }

            // Generate indices for the tube
            for (let j = 0; j < tubularSegments; j++) {
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
        logger.info(`Processing ${data.length} dislocation segments...`);

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

        for (const segment of data) {
            if (!segment.points || segment.points.length < options.minSegmentPoints) {
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

            if (geometry.positions.length === 0) continue;

            allPositions.push(...geometry.positions);
            allNormals.push(...geometry.normals);

            if (options.colorByType) {
                const color = typeColors[calculatedType] || typeColors['default'];
                const vertexCount = geometry.positions.length / 3;
                for (let i = 0; i < vertexCount; i++) {
                    allColors.push(...color);
                }
            }

            for (const index of geometry.indices) {
                allIndices.push(index + currentVertexOffset);
            }

            currentVertexOffset += geometry.positions.length / 3;
        }

        logger.info(`Processed ${validSegments} valid segments.`);
        logger.info(`Dislocation type distribution: ${JSON.stringify(typeStats)}`);

        const positions = new Float32Array(allPositions);
        const normals = new Float32Array(allNormals);
        const indices = new Uint32Array(allIndices);
        const colors = options.colorByType ? new Float32Array(allColors) : undefined;

        const allPoints: [number, number, number][] = [];
        for (let i = 0; i < positions.length; i += 3) {
            allPoints.push([positions[i], positions[i + 1], positions[i + 2]]);
        }

        const bounds = computeBoundsFromPoints(allPoints);

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

    // Removed createGLB method - use toGLBBuffer instead

    private convertStorageFormatToDislocationFormat(storage: any): any {
        const dislocationSegments = storage.dislocations.map((segment: any) => ({
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
                count: storage.totalSegments,
                timestep: storage.timestep,
                trajectoryId: storage.trajectory,
                analysisConfigId: storage.analysisConfig
            },
            summary: {
                total_points: storage.totalPoints,
                average_segment_length: storage.averageSegmentLength,
                max_segment_length: storage.maxSegmentLength,
                min_segment_length: storage.minSegmentLength,
                total_length: storage.totalLength
            }
        };
    }

    // TODO:
    public async rebuildGLBFromDB(
        analysisConfigId: string,
        timestep: number,
        trajectoryId: string,
        minioKey: string,
        options: DislocationExportOptions = {}
    ): Promise<void> {
        try {
            const key = `${trajectoryId}/${analysisConfigId}/${timestep}.json`;

            logger.info(`[DislocationExporter] Rebuilding GLB from MinIO object: ${key}`);
            const storageObject = await getObject(key, SYS_BUCKETS.MODELS);
            if (!storageObject) {
                throw new Error(`No dislocation object found in MinIO for key ${key}`);
            }

            const dislocationData = this.convertStorageFormatToDislocationFormat(storageObject);

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

            // Upload to MinIO instead of writing to filesystem
            const buffer = this.toGLBBuffer(dislocationData, options);
            await putObject(minioKey, SYS_BUCKETS.MODELS, buffer, { 'Content-Type': 'model/gltf-binary' });

            logger.info(`[DislocationExporter] GLB successfully rebuilt and uploaded to MinIO: ${minioKey}`);
            logger.info(`[DislocationExporter] Statistics: ${processedGeometry.triangleCount} triangles, ${processedGeometry.vertexCount} vertices`);

        } catch (error) {
            logger.error(`[DislocationExporter] Failed to rebuild GLB from DB: ${error}`);
            throw error;
        }
    }

    // Removed toGLB method - use toGLBMinIO instead

    public toGLBBuffer(
        dislocationData: any,
        options: DislocationExportOptions = {}
    ): Buffer {
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

        const useU16 = processedGeometry.vertexCount > 0 && processedGeometry.vertexCount <= 65535;
        const idx = useU16 ? new Uint16Array(processedGeometry.indices) : processedGeometry.indices;

        const { glb, arrayBuffer } = buildPrimitiveGLB({
            positions: processedGeometry.positions,
            normals: processedGeometry.normals,
            colors: processedGeometry.colors,
            indices: idx,
            mode: 4,
            nodeName: 'Dislocations',
            meshName: 'DislocationGeometry',
            generator: 'OpenDXA Dislocation Exporter',
            copyright: 'https://github.com/rodyherrera/OpenDXA',
            material: {
                baseColor: opts.material.baseColor,
                metallic: opts.material.metallic,
                roughness: opts.material.roughness,
                emissive: opts.material.emissive,
                doubleSided: true,
                name: 'DislocationMaterial'
            },
            extras: opts.metadata.includeOriginalStats ? {
                stats: {
                    vertexCount: processedGeometry.vertexCount,
                    triangleCount: processedGeometry.triangleCount,
                    segmentCount: processedGeometry.triangleCount / (opts.tubularSegments * 2)
                },
                ...opts.metadata.customProperties
            } : opts.metadata.customProperties
        });

        const accPos = glb.accessors[0];
        accPos.min = processedGeometry.bounds.min;
        accPos.max = processedGeometry.bounds.max;

        return assembleGLBToBuffer(glb, arrayBuffer);
    }

    public async toGLBMinIO(
        dislocationData: any,
        minioObjectName: string,
        options: DislocationExportOptions = {}
    ): Promise<void> {
        const buffer = this.toGLBBuffer(dislocationData, options);
        await putObject(minioObjectName, SYS_BUCKETS.MODELS, buffer, { 'Content-Type': 'model/gltf-binary' });
    }
};

export default DislocationExporter;
