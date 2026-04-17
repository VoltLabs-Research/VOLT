import { normalizePagination, calculatePaginationOffset } from '@/contracts/pagination';
import { logger } from '@/core/logger';
import { NativeModuleOperation, withNativeProcessingTempDir } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http.objectStore';
import { createZstdDecompressionStream, toCompressedDumpObjectKey } from '@/support/serialization/storage-codec';
import type { NativeAtomPageEntry, NativeAtomsPageRequest, NativeAtomsPageResponse } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import type { NativeDataResult, NativeDumpResult, NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import type { NativePropertyStatsRequest, NativeStatsResult, NativeTrajectoryRequest, NativeUniqueValuesRequest } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import type { ParseOptions, ParsedTrajectory } from '@/core/runtime/infrastructure/native/NativeModuleLoader';

interface ObjectStoreError extends Error {
    code?: 'NoSuchKey' | 'NotFound';
};

const toParsedDumpResult = (result: NativeDumpResult): ParsedTrajectory => {
    const width = result.max[0] - result.min[0];
    const length = result.max[1] - result.min[1];
    const height = result.max[2] - result.min[2];

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
                    cell_vectors: [[width, 0, 0], [0, length, 0], [0, 0, height]],
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
};

const toParsedDataResult = (result: NativeDataResult): ParsedTrajectory => {
    const width = result.max[0] - result.min[0];
    const length = result.max[1] - result.min[1];
    const height = result.max[2] - result.min[2];

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
                    cell_vectors: [[width, 0, 0], [0, length, 0], [0, 0, height]],
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
};

export interface TrajectoryParserService {
    getTrajectoryMetadata(input: NativeTrajectoryRequest): Promise<ParsedTrajectory['metadata']>;
    getPropertyStats(input: NativePropertyStatsRequest): Promise<NativeStatsResult>;
    getUniqueValues(input: NativeUniqueValuesRequest): Promise<number[]>;
    getAtomIds(input: NativeTrajectoryRequest): Promise<number[]>;
    getAtomsPage(input: NativeAtomsPageRequest): Promise<NativeAtomsPageResponse>;
    withDumpFile<T>(input: NativeTrajectoryRequest, action: (dumpPath: string) => Promise<T>): Promise<T>;
    parseTrajectory(filePath: string, options?: ParseOptions): ParsedTrajectory;
    getPropertyValues(parsed: ParsedTrajectory, property: string): Float32Array;
    remapExternalValues(parsed: ParsedTrajectory, externalValues: Float32Array): Float32Array;
    decodeFloat32Array(value: string): Float32Array;
    decodeUint8Array(value: string): Uint8Array;
    getModelObjectKey(trajectoryId: string, timestep: number): string;
};

export const createTrajectoryParserService = (
    objectStore: ClusterObjectStore,
    nativeModuleLoader: NativeModuleLoader
): TrajectoryParserService => ({
    getTrajectoryMetadata(input) {
        return this.withDumpFile(input, (dumpPath) => {
            return Promise.resolve(this.parseTrajectory(dumpPath, {
                properties: []
            }).metadata);
        });
    },

    getPropertyStats(input) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.PropertyStats, {
            objectKey: input.objectKey,
            timestep: input.timestep,
            trajectoryId: input.trajectoryId
        });
        return this.withDumpFile(input, (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                throw new Error(`Property '${input.property}' not found in trajectory dump`);
            }

            return Promise.resolve(nativeModuleLoader.getStatsModule().getStatsForProperty(dumpPath, propertyIndex));
        });
    },

    getUniqueValues(input) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.UniqueValues, {
            objectKey: input.objectKey,
            timestep: input.timestep,
            trajectoryId: input.trajectoryId
        });
        return this.withDumpFile(input, (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                return Promise.resolve([]);
            }

            return Promise.resolve(nativeModuleLoader.getStatsModule().getUniqueValuesForProperty(dumpPath, propertyIndex, input.maxValues));
        });
    },

    getAtomsPage(input) {
        return this.withDumpFile(input, (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: ['*']
            });
            const totalAtoms = parsed.ids ? parsed.ids.length : parsed.positions.length / 3;
            const pagination = normalizePagination(input.page, input.limit);
            const startIndex = calculatePaginationOffset(pagination.page, pagination.limit);
            const endIndex = Math.min(totalAtoms, startIndex + pagination.limit);
            const atoms = [];
            const properties = parsed.properties;
            const nativeProperties = properties ? Object.keys(properties) : [];

            for (let index = startIndex; index < endIndex; index++) {
                const atom: NativeAtomPageEntry = {
                    id: Number(parsed.ids ? parsed.ids[index] : index + 1),
                    type: Number(parsed.types[index]),
                    x: Number(parsed.positions[index * 3]),
                    y: Number(parsed.positions[index * 3 + 1]),
                    z: Number(parsed.positions[index * 3 + 2])
                };

                for (const propName of nativeProperties) {
                    const values = properties![propName];
                    atom[propName] = Number(values[index]);
                }

                atoms.push(atom);
            }

            return Promise.resolve({
                atoms,
                totalAtoms,
                nativeProperties
            });
        });
    },

    getAtomIds(input) {
        return this.withDumpFile(input, (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: []
            });

            if (!parsed.ids) {
                throw new Error('Trajectory atom ids are required for atom-id lookup');
            }

            return Promise.resolve(Array.from(parsed.ids, (id) => Number(id)));
        });
    },

    async withDumpFile<T>(input: NativeTrajectoryRequest, action: (dumpPath: string) => Promise<T>): Promise<T> {
        return withNativeProcessingTempDir('trajectory-dump', async (tempDirectory) => {
            const tempDumpPath = path.join(tempDirectory, 'input.dump');
            const objectKey = input.objectKey || toCompressedDumpObjectKey(input.trajectoryId, input.timestep);
            const ownerClusterId = input.ownerClusterId;
            const startTime = Date.now();

            if (!ownerClusterId) {
                throw new Error(`Missing dump owner cluster for trajectory ${input.trajectoryId} timestep ${input.timestep}`);
            }

            logger.info(
                {
                    objectKey,
                    tempDumpPath,
                    timestep: input.timestep,
                    trajectoryId: input.trajectoryId
                },
                'Preparing local dump file for native trajectory processing'
            );

            try {
                const response = await objectStore.getStream(ownerClusterId, ObjectBucketName.Dumps, objectKey, {
                    skipMetadata: true
                });
                const decompressed = createZstdDecompressionStream(response.stream);
                await pipeline(decompressed.stream, createWriteStream(tempDumpPath));
                await decompressed.completion;
                const dumpStats = await fs.stat(tempDumpPath);

                logger.info(
                    {
                        durationMs: Date.now() - startTime,
                        objectKey,
                        sizeBytes: dumpStats.size,
                        tempDumpPath,
                        timestep: input.timestep,
                        trajectoryId: input.trajectoryId
                    },
                    'Local dump file ready for native trajectory processing'
                );

                return await action(tempDumpPath);
            } catch (error) {
                const { code } = error as ObjectStoreError;
                if (code === 'NoSuchKey' || code === 'NotFound') {
                    const dumpNotFoundError = new Error(
                        `Dump object not found in S3: bucket=${ObjectBucketName.Dumps}, ` +
                        `key=${objectKey}, trajectoryId=${input.trajectoryId}, timestep=${input.timestep}. ` +
                        `The dump file may not have been uploaded successfully.`
                    );
                    dumpNotFoundError.name = 'DumpNotFoundError';
                    throw dumpNotFoundError;
                }

                throw error;
            }
        });
    },

    parseTrajectory(filePath, options = {}) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.ParseTrajectory, {
            filePath
        });
        const parseStart = Date.now();
        const dumpResult = nativeModuleLoader.getDumpParserModule().parseDump(filePath, {
            includeIds: options.includeIds,
            properties: options.properties
        });
        if (dumpResult) {
            logger.info(
                {
                    atomCount: dumpResult.metadata.natoms,
                    durationMs: Date.now() - parseStart,
                    filePath,
                    format: 'dump',
                    headers: dumpResult.metadata.headers,
                    timestep: dumpResult.metadata.timestep
                },
                'Native trajectory parse completed with dump parser'
            );
            return toParsedDumpResult(dumpResult);
        }

        logger.warn(
            {
                filePath
            },
            'Native dump parser returned no result, falling back to native data parser'
        );
        const dataResult = nativeModuleLoader.getDataParserModule().parseData(filePath, {
            includeIds: options.includeIds
        });
        if (dataResult) {
            logger.info(
                {
                    atomCount: dataResult.metadata.natoms,
                    durationMs: Date.now() - parseStart,
                    filePath,
                    format: 'data',
                    timestep: dataResult.metadata.timestep
                },
                'Native trajectory parse completed with data parser'
            );
            return toParsedDataResult(dataResult);
        }

        logger.error(
            {
                durationMs: Date.now() - parseStart,
                filePath
            },
            'Native trajectory parse failed for all supported formats'
        );
        throw new Error('Unsupported trajectory format');
    },

    getPropertyValues(parsed, property) {
        const lowerProperty = property.toLowerCase();
        const axisIndex = ({
            x: 0,
            y: 1,
            z: 2
        } as const)[lowerProperty as 'x' | 'y' | 'z'];

        if (lowerProperty === 'type') {
            return new Float32Array(parsed.types);
        }

        if (axisIndex !== undefined) {
            const values = new Float32Array(parsed.positions.length / 3);
            for (let index = 0; index < values.length; index++) {
                values[index] = parsed.positions[index * 3 + axisIndex];
            }

            return values;
        }

        if (lowerProperty === 'id' && parsed.ids) {
            return Float32Array.from(parsed.ids);
        }

        const properties = parsed.properties;
        if (!properties) {
            return new Float32Array(0);
        }

        return properties[property] ?? properties[lowerProperty] ?? new Float32Array(0);
    },

    remapExternalValues(parsed, externalValues) {
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for external values');
        }

        const values = new Float32Array(parsed.ids.length);
        for (let index = 0; index < parsed.ids.length; index++) {
            values[index] = externalValues[parsed.ids[index]];
        }

        return values;
    },

    decodeFloat32Array(value) {
        const buffer = Buffer.from(value, 'base64');
        return new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / Float32Array.BYTES_PER_ELEMENT));
    },

    decodeUint8Array(value) {
        return new Uint8Array(Buffer.from(value, 'base64'));
    },

    getModelObjectKey(trajectoryId, timestep) {
        return `trajectory-${trajectoryId}/timestep-${timestep}.glb.zst`;
    }
});
