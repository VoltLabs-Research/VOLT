import { ObjectBucketName } from '../../contracts/http';
import { MinioService } from '../../infrastructure/minio/MinioService';
import {
    NativeModuleLoader,
    type NativeAtomsPageRequest,
    type NativeAtomsPageResponse,
    type NativePropertyStatsRequest,
    type NativeStatsResult,
    type NativeTrajectoryRequest,
    type NativeUniqueValuesRequest,
    type ParseOptions,
    type ParsedTrajectory,
    type NativeDataResult,
    type NativeDumpResult
} from './NativeModuleLoader';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export class TrajectoryParserService {
    private readonly runtimeDir = path.join(process.cwd(), '.runtime', 'native-processing');

    constructor(
        private readonly minioService: MinioService,
        private readonly nativeModuleLoader: NativeModuleLoader
    ) {
    }

    async getTrajectoryMetadata(input: NativeTrajectoryRequest): Promise<ParsedTrajectory['metadata']> {
        return this.withDumpFile(input, async (dumpPath) => {
            return this.parseTrajectory(dumpPath, {
                properties: []
            }).metadata;
        });
    }

    async getPropertyStats(input: NativePropertyStatsRequest): Promise<NativeStatsResult> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                throw new Error(`Property '${input.property}' not found in trajectory dump`);
            }

            return this.nativeModuleLoader.getStatsModule().getStatsForProperty(dumpPath, propertyIndex);
        });
    }

    async getUniqueValues(input: NativeUniqueValuesRequest): Promise<number[]> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                return [];
            }

            return this.nativeModuleLoader.getStatsModule().getUniqueValuesForProperty(dumpPath, propertyIndex, input.maxValues);
        });
    }

    async getAtomsPage(input: NativeAtomsPageRequest): Promise<NativeAtomsPageResponse> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: []
            });
            const totalAtoms = parsed.ids?.length || parsed.positions.length / 3;
            const page = Math.max(1, input.page);
            const limit = Math.max(1, input.limit);
            const startIndex = (page - 1) * limit;
            const endIndex = Math.min(totalAtoms, startIndex + limit);
            const atoms = [];

            for (let index = startIndex; index < endIndex; index++) {
                atoms.push({
                    id: Number(parsed.ids ? parsed.ids[index] : index + 1),
                    type: Number(parsed.types[index]),
                    x: Number(parsed.positions[index * 3]),
                    y: Number(parsed.positions[index * 3 + 1]),
                    z: Number(parsed.positions[index * 3 + 2])
                });
            }

            return {
                atoms,
                totalAtoms
            };
        });
    }

    async withDumpFile<T>(input: NativeTrajectoryRequest, action: (dumpPath: string) => Promise<T>): Promise<T> {
        await fs.mkdir(this.runtimeDir, {
            recursive: true
        });

        const tempDumpPath = this.createTempPath('.dump');
        const objectKey = input.objectKey || this.getDumpObjectKey(input.trajectoryId, input.timestep);

        try {
            const stream = await this.minioService.getObjectStream(ObjectBucketName.Dumps, objectKey);
            await pipeline(stream, zlib.createGunzip(), createWriteStream(tempDumpPath));
            return action(tempDumpPath);
        } finally {
            await fs.unlink(tempDumpPath).catch(() => {});
        }
    }

    parseTrajectory(filePath: string, options: ParseOptions = {}): ParsedTrajectory {
        const dumpResult = this.nativeModuleLoader.getDumpParserModule().parseDump(filePath, {
            includeIds: options.includeIds,
            properties: options.properties
        });
        if (dumpResult) {
            return this.toParsedDumpResult(dumpResult);
        }

        const dataResult = this.nativeModuleLoader.getDataParserModule().parseData(filePath, {
            includeIds: options.includeIds
        });
        if (dataResult) {
            return this.toParsedDataResult(dataResult);
        }

        throw new Error('Unsupported trajectory format');
    }

    getPropertyValues(parsed: ParsedTrajectory, property: string): Float32Array {
        const lowerProperty = property.toLowerCase();

        if (lowerProperty === 'type') {
            return new Float32Array(parsed.types);
        }

        if (lowerProperty === 'x') {
            return this.extractAxisValues(parsed.positions, 0);
        }

        if (lowerProperty === 'y') {
            return this.extractAxisValues(parsed.positions, 1);
        }

        if (lowerProperty === 'z') {
            return this.extractAxisValues(parsed.positions, 2);
        }

        if (lowerProperty === 'id' && parsed.ids) {
            const values = new Float32Array(parsed.ids.length);
            for (let index = 0; index < parsed.ids.length; index++) {
                values[index] = parsed.ids[index];
            }

            return values;
        }

        return parsed.properties?.[property] || parsed.properties?.[lowerProperty] || new Float32Array(0);
    }

    remapExternalValues(parsed: ParsedTrajectory, externalValues: Float32Array): Float32Array {
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for external values');
        }

        const values = new Float32Array(parsed.ids.length);
        for (let index = 0; index < parsed.ids.length; index++) {
            values[index] = externalValues[parsed.ids[index]] || 0;
        }

        return values;
    }

    decodeFloat32Array(value: string): Float32Array {
        const buffer = Buffer.from(value, 'base64');
        return new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / Float32Array.BYTES_PER_ELEMENT));
    }

    decodeUint8Array(value: string): Uint8Array {
        return new Uint8Array(Buffer.from(value, 'base64'));
    }

    getModelObjectKey(trajectoryId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.glb`;
    }

    getPreviewObjectKey(trajectoryId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`;
    }

    private createTempPath(extension: string): string {
        return path.join(this.runtimeDir, `${randomUUID()}${extension}`);
    }

    private getDumpObjectKey(trajectoryId: string, timestep: number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }

    private extractAxisValues(positions: Float32Array, axis: number): Float32Array {
        const values = new Float32Array(positions.length / 3);
        for (let index = 0; index < values.length; index++) {
            values[index] = positions[index * 3 + axis];
        }

        return values;
    }

    private toParsedDumpResult(result: NativeDumpResult): ParsedTrajectory {
        const width = result.max[0] - result.min[0];
        const height = result.max[1] - result.min[1];
        const length = result.max[2] - result.min[2];

        return {
            metadata: {
                ...result.metadata,
                simulationCell: {
                    boundingBox: {
                        width,
                        height,
                        length
                    },
                    geometry: {
                        cell_vectors: [[width, 0, 0], [0, height, 0], [0, 0, length]],
                        cell_origin: result.min,
                        periodic_boundary_conditions: {
                            x: true,
                            y: true,
                            z: true
                        }
                    }
                }
            },
            positions: result.positions,
            types: result.types,
            ids: result.ids,
            properties: result.properties,
            min: result.min,
            max: result.max
        };
    }

    private toParsedDataResult(result: NativeDataResult): ParsedTrajectory {
        const width = result.max[0] - result.min[0];
        const height = result.max[1] - result.min[1];
        const length = result.max[2] - result.min[2];

        return {
            metadata: {
                ...result.metadata,
                simulationCell: {
                    boundingBox: {
                        width,
                        height,
                        length
                    },
                    geometry: {
                        cell_vectors: [[width, 0, 0], [0, height, 0], [0, 0, length]],
                        cell_origin: result.min,
                        periodic_boundary_conditions: {
                            x: true,
                            y: true,
                            z: true
                        }
                    }
                }
            },
            positions: result.positions,
            types: result.types,
            ids: result.ids,
            min: result.min,
            max: result.max
        };
    }
};
