import { calculatePaginationOffset, ObjectBucketName, normalizePagination } from '@/shared/contracts';
import { logger } from '@/core/logger';
import {
    createNativeProcessingTempPath,
    NATIVE_PROCESSING_RUNTIME_DIR,
    NativeModuleOperation
} from './NativeModuleLoader';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import type {
    NativeAtomPageEntry,
    NativeAtomsPageRequest,
    NativeAtomsPageResponse,
    NativeDataResult,
    NativeDumpResult,
    NativeModuleLoader,
    NativePropertyStatsRequest,
    NativeStatsResult,
    NativeTrajectoryRequest,
    NativeUniqueValuesRequest,
    ParseOptions,
    ParsedTrajectory
} from './NativeModuleLoader';

const getDumpObjectKey = (trajectoryId: string, timestep: number): string => {
    return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
};

const extractAxisValues = (positions: Float32Array, axis: number): Float32Array => {
    const values = new Float32Array(positions.length / 3);
    for (let index = 0; index < values.length; index++) {
        values[index] = positions[index * 3 + axis];
    }

    return values;
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
    getPreviewObjectKey(trajectoryId: string, timestep: number): string;
};

export const createTrajectoryParserService = (
    objectStore: ClusterObjectStore,
    nativeModuleLoader: NativeModuleLoader
): TrajectoryParserService => ({
    async getTrajectoryMetadata(input) {
        return this.withDumpFile(input, async (dumpPath) => {
            return this.parseTrajectory(dumpPath, {
                properties: []
            }).metadata;
        });
    },

    async getPropertyStats(input) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.PropertyStats, {
            objectKey: input.objectKey,
            timestep: input.timestep,
            trajectoryId: input.trajectoryId
        });
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                throw new Error(`Property '${input.property}' not found in trajectory dump`);
            }

            return nativeModuleLoader.getStatsModule().getStatsForProperty(dumpPath, propertyIndex);
        });
    },

    async getUniqueValues(input) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.UniqueValues, {
            objectKey: input.objectKey,
            timestep: input.timestep,
            trajectoryId: input.trajectoryId
        });
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                properties: []
            });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                return [];
            }

            return nativeModuleLoader.getStatsModule().getUniqueValuesForProperty(dumpPath, propertyIndex, input.maxValues);
        });
    },

    async getAtomsPage(input) {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: ['*']
            });
            const totalAtoms = parsed.ids?.length || parsed.positions.length / 3;
            const pagination = normalizePagination(input.page, input.limit);
            const startIndex = calculatePaginationOffset(pagination.page, pagination.limit);
            const endIndex = Math.min(totalAtoms, startIndex + pagination.limit);
            const atoms = [];
            const nativeProperties = parsed.properties ? Object.keys(parsed.properties) : [];

            for (let index = startIndex; index < endIndex; index++) {
                const atom: NativeAtomPageEntry = {
                    id: Number(parsed.ids ? parsed.ids[index] : index + 1),
                    type: Number(parsed.types[index]),
                    x: Number(parsed.positions[index * 3]),
                    y: Number(parsed.positions[index * 3 + 1]),
                    z: Number(parsed.positions[index * 3 + 2])
                };

                for (const propName of nativeProperties) {
                    const values = parsed.properties![propName];
                    atom[propName] = Number(values[index]);
                }

                atoms.push(atom);
            }

            return {
                atoms,
                totalAtoms,
                nativeProperties
            };
        });
    },

    async getAtomIds(input) {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: []
            });

            if (!parsed.ids) {
                throw new Error('Trajectory atom ids are required for atom-id lookup');
            }

            return Array.from(parsed.ids, (id) => Number(id));
        });
    },

    async withDumpFile<T>(input: NativeTrajectoryRequest, action: (dumpPath: string) => Promise<T>): Promise<T> {
        await fs.mkdir(NATIVE_PROCESSING_RUNTIME_DIR, {
            recursive: true
        });

        const tempDumpPath = createNativeProcessingTempPath('.dump');
        const objectKey = input.objectKey || getDumpObjectKey(input.trajectoryId, input.timestep);
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
            // DIAG: Pre-download verification — check if object exists before attempting download
            try {
                const stat = await objectStore.head(ownerClusterId, ObjectBucketName.Dumps, objectKey);
                logger.info(
                    {
                        objectKey,
                        bucket: ObjectBucketName.Dumps,
                        minioSize: stat.contentLength,
                        timestep: input.timestep,
                        trajectoryId: input.trajectoryId
                    },
                    'DIAG: Pre-download statObject succeeded — dump exists in MinIO'
                );
            } catch (statError: unknown) {
                // List objects with the trajectory prefix to understand what IS in the bucket.
                const prefix = `trajectory-${input.trajectoryId}/`;
                let existingKeys: string[] = [];
                try {
                    const page = await objectStore.list(ownerClusterId, {
                        bucket: ObjectBucketName.Dumps,
                        prefix,
                        limit: 20
                    });
                    existingKeys = page.keys;
                } catch {
                    // Ignore listing errors
                }

                logger.error(
                    {
                        objectKey,
                        bucket: ObjectBucketName.Dumps,
                        timestep: input.timestep,
                        trajectoryId: input.trajectoryId,
                        prefix,
                        existingKeysInPrefix: existingKeys,
                        existingKeyCount: existingKeys.length,
                        err: statError
                    },
                    'DIAG: Pre-download statObject FAILED — dump NOT found in MinIO before download attempt'
                );
            }

            const response = await objectStore.getStream(ownerClusterId, ObjectBucketName.Dumps, objectKey);
            await pipeline(response.stream, zlib.createGunzip(), createWriteStream(tempDumpPath));
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
        } catch (error: unknown) {
            // Provide a clear error message for missing S3 objects
            if (
                error !== null &&
                typeof error === 'object' &&
                'code' in error &&
                ((error as Record<string, unknown>).code === 'NoSuchKey' ||
                 (error as Record<string, unknown>).code === 'NotFound')
            ) {
                const dumpNotFoundError = new Error(
                    `Dump object not found in S3: bucket=${ObjectBucketName.Dumps}, ` +
                    `key=${objectKey}, trajectoryId=${input.trajectoryId}, timestep=${input.timestep}. ` +
                    `The dump file may not have been uploaded successfully.`
                );
                dumpNotFoundError.name = 'DumpNotFoundError';
                throw dumpNotFoundError;
            }

            throw error;
        } finally {
            await fs.unlink(tempDumpPath).catch(() => {});
        }
    },

    parseTrajectory(filePath, options = {}) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.ParseTrajectory, {
            filePath
        });
        const parseStart = Date.now();

        logger.info(
            {
                filePath,
                includeIds: options.includeIds ?? false,
                requestedProperties: options.properties ?? []
            },
            'Starting native trajectory parse'
        );

        logger.info(
            {
                filePath
            },
            'Invoking native dump parser'
        );
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
        logger.info(
            {
                filePath
            },
            'Invoking native data parser'
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

        if (lowerProperty === 'type') {
            return new Float32Array(parsed.types);
        }

        if (lowerProperty === 'x') {
            return extractAxisValues(parsed.positions, 0);
        }

        if (lowerProperty === 'y') {
            return extractAxisValues(parsed.positions, 1);
        }

        if (lowerProperty === 'z') {
            return extractAxisValues(parsed.positions, 2);
        }

        if (lowerProperty === 'id' && parsed.ids) {
            const values = new Float32Array(parsed.ids.length);
            for (let index = 0; index < parsed.ids.length; index++) {
                values[index] = parsed.ids[index];
            }

            return values;
        }

        return parsed.properties?.[property] || parsed.properties?.[lowerProperty] || new Float32Array(0);
    },

    remapExternalValues(parsed, externalValues) {
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for external values');
        }

        const values = new Float32Array(parsed.ids.length);
        values.fill(Number.NaN);
        for (let index = 0; index < parsed.ids.length; index++) {
            const atomId = parsed.ids[index];
            const externalValue = externalValues[atomId];
            values[index] = Number.isFinite(externalValue) ? externalValue : Number.NaN;
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
        return `trajectory-${trajectoryId}/timestep-${timestep}.glb`;
    },

    getPreviewObjectKey(trajectoryId, timestep) {
        return `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`;
    }
});
