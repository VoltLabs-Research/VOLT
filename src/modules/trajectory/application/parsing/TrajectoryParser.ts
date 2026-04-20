import { Service } from '@/core/decorators/service';
import { normalizePagination, calculatePaginationOffset } from '@/contracts/pagination';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { createZstdDecompressionStream, toCompressedDumpObjectKey } from '@/support/serialization/storage-codec';
import { dataParser, dumpParser, statsParser, type NativeParseResult } from '@voltstack/lammps-io';
import type { ParsedSimulationCell } from '@/modules/trajectory/application/parsing/TrajectoryParserFactory';

interface ObjectStoreError extends Error {
    code?: 'NoSuchKey' | 'NotFound';
};

export interface ParsedTrajectoryMetadata {
    headers: string[];
    simulationCell: ParsedSimulationCell;
}

export interface ParsedTrajectory {
    metadata: ParsedTrajectoryMetadata;
    positions: Float32Array;
    types: Uint16Array;
    ids?: NativeParseResult['ids'];
    properties?: NativeParseResult['properties'];
    min: [number, number, number];
    max: [number, number, number];
}

export interface TrajectoryParseOptions {
    includeIds?: boolean;
    properties?: string[];
}

export interface DumpFileInput {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey?: string;
}

export interface PropertyStatsInput extends DumpFileInput {
    property: string;
}

export interface UniqueValuesInput extends PropertyStatsInput {
    maxValues: number;
}

export interface AtomsPageInput extends DumpFileInput {
    page: number;
    limit: number;
}

export interface AtomsPageRow {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: number;
}

export interface AtomsPageResult {
    atoms: AtomsPageRow[];
    totalAtoms: number;
    nativeProperties: string[];
}

const toParsedTrajectory = (result: NativeParseResult): ParsedTrajectory => {
    const width = result.max[0] - result.min[0];
    const length = result.max[1] - result.min[1];
    const height = result.max[2] - result.min[2];

    return {
        metadata: {
            ...result.metadata,
            simulationCell: {
                boundingBox: { width, height, length },
                geometry: {
                    cell_vectors: [[width, 0, 0], [0, length, 0], [0, 0, height]],
                    cell_origin: result.min,
                    periodic_boundary_conditions: { x: true, y: true, z: true }
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

@Service('trajectoryParser')
export class TrajectoryParser {
    constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    getTrajectoryMetadata(input: DumpFileInput): Promise<ParsedTrajectoryMetadata> {
        return this.withDumpFile(input, async (dumpPath) => (
            this.parseTrajectory(dumpPath, { properties: [] }).metadata
        ));
    }

    getPropertyStats(input: PropertyStatsInput): Promise<{ min: number; max: number }> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, { properties: [] });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                throw new Error(`Property '${input.property}' not found in trajectory dump`);
            }

            return statsParser.getStatsForProperty(dumpPath, propertyIndex);
        });
    }

    getUniqueValues(input: UniqueValuesInput): Promise<number[]> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, { properties: [] });
            const propertyIndex = parsed.metadata.headers.indexOf(input.property.toLowerCase());
            if (propertyIndex === -1) {
                return [];
            }

            return statsParser.getUniqueValuesForProperty(dumpPath, propertyIndex, input.maxValues);
        });
    }

    getAtomsPage(input: AtomsPageInput): Promise<AtomsPageResult> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: ['*']
            });
            const totalAtoms = parsed.ids ? parsed.ids.length : parsed.positions.length / 3;
            const pagination = normalizePagination(input.page, input.limit);
            const startIndex = calculatePaginationOffset(pagination.page, pagination.limit);
            const endIndex = Math.min(totalAtoms, startIndex + pagination.limit);
            const properties = parsed.properties;
            const nativeProperties = properties ? Object.keys(properties) : [];
            const atoms: AtomsPageRow[] = [];

            for (let index = startIndex; index < endIndex; index++) {
                const atom: AtomsPageRow = {
                    id: parsed.ids ? parsed.ids[index] : index + 1,
                    type: parsed.types[index],
                    x: parsed.positions[index * 3],
                    y: parsed.positions[index * 3 + 1],
                    z: parsed.positions[index * 3 + 2]
                };

                for (const propName of nativeProperties) {
                    atom[propName] = properties![propName][index];
                }

                atoms.push(atom);
            }

            return { atoms, totalAtoms, nativeProperties };
        });
    }

    getAtomIds(input: DumpFileInput): Promise<number[]> {
        return this.withDumpFile(input, async (dumpPath) => {
            const parsed = this.parseTrajectory(dumpPath, {
                includeIds: true,
                properties: []
            });

            if (!parsed.ids) {
                throw new Error('Trajectory atom ids are required for atom-id lookup');
            }

            return Array.from(parsed.ids);
        });
    }

    async withDumpFile<T>(input: DumpFileInput, action: (dumpPath: string) => Promise<T>): Promise<T> {
        return withNativeProcessingTempDir('trajectory-dump', async (tempDirectory) => {
            const tempDumpPath = path.join(tempDirectory, 'input.dump');
            const objectKey = input.objectKey ?? toCompressedDumpObjectKey(input.trajectoryId, input.timestep);

            try {
                const response = await this.objectStore.getStream(input.ownerClusterId, ObjectBucketName.Dumps, objectKey, {
                    skipMetadata: true
                });
                const decompressed = createZstdDecompressionStream(response.stream);
                await pipeline(decompressed.stream, createWriteStream(tempDumpPath));
                await decompressed.completion;

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
    }

    parseTrajectory(filePath: string, options: TrajectoryParseOptions = {}): ParsedTrajectory {
        const dumpResult = dumpParser.parseDump(filePath, options);
        if (dumpResult) {
            return toParsedTrajectory(dumpResult);
        }

        const dataResult = dataParser.parseData(filePath, { includeIds: options.includeIds });
        if (dataResult) {
            return toParsedTrajectory(dataResult);
        }

        throw new Error('Unsupported trajectory format');
    }

    getPropertyValues(parsed: ParsedTrajectory, property: string): Float32Array {
        const lowerProperty = property.toLowerCase();
        const axisIndex = ({ x: 0, y: 1, z: 2 } as const)[lowerProperty as 'x' | 'y' | 'z'];

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

        const source = properties[property] ?? properties[lowerProperty];
        return source ? new Float32Array(source) : new Float32Array(0);
    }

    remapExternalValues(parsed: ParsedTrajectory, externalValues: Float32Array): Float32Array {
        if (!parsed.ids) {
            throw new Error('Trajectory atom ids are required for external values');
        }

        const values = new Float32Array(parsed.ids.length);
        for (let index = 0; index < parsed.ids.length; index++) {
            values[index] = externalValues[parsed.ids[index]];
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
        return `trajectory-${trajectoryId}/timestep-${timestep}.glb.zst`;
    }
}
