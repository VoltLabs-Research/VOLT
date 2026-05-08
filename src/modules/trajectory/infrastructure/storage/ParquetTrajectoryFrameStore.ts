import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { DuckDBConnection } from '@duckdb/node-api';
import { dataParser, dumpParser, type NativeParseResult } from '@voltstack/lammps-io';

import { DAEMON_PATHS } from '@/core/paths';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { isObjectNotFoundError } from '@/core/storage/contracts/cluster-object-store';
import {
    type TrajectoryFrameData,
    type TrajectoryFrameLookupInput,
    type TrajectoryFrameStore,
    type TrajectoryFrameStoreIngestInput,
    type TrajectoryFrameStoreIngestResult
} from '@/modules/trajectory/application/storage/TrajectoryFrameStore';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { toTrajectoryParquetObjectKey } from '@/support/serialization/storage-codec';

const BASE_COLUMNS = ['timestep', 'atom_index', 'id', 'type', 'x', 'y', 'z'] as const;
const BASE_COLUMN_SET = new Set<string>(BASE_COLUMNS);
const PARQUET_CACHE_MAX_FRAMES = 128;

interface CachedFrame {
    frame: TrajectoryFrameData;
    bytes: number;
}

const quoteIdentifier = (value: string): string =>
    `"${value.replace(/"/g, '""')}"`;

const sqlString = (value: string): string =>
    `'${value.replace(/'/g, "''")}'`;

const normalizeCustomPropertyNames = (properties: string[] | undefined): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const property of properties ?? []) {
        const name = property.trim();
        if (!name || BASE_COLUMN_SET.has(name) || seen.has(name)) continue;
        seen.add(name);
        result.push(name);
    }

    return result;
};

const readFrameFromFile = (filePath: string, includeProperties: string[] | undefined): NativeParseResult => {
    const dumpResult = dumpParser.parseDump(filePath, {
        includeIds: true,
        properties: includeProperties ?? []
    });
    if (dumpResult) return dumpResult;

    const dataResult = dataParser.parseData(filePath, { includeIds: true });
    if (dataResult) return dataResult;

    throw new Error(`Unsupported trajectory format: ${filePath}`);
};

const toFloat32PropertyMap = (
    properties: NativeParseResult['properties']
): Record<string, Float32Array> | undefined => {
    if (!properties) return undefined;
    const entries = Object.entries(properties);
    if (entries.length === 0) return undefined;
    const result: Record<string, Float32Array> = {};
    for (const [name, values] of entries) {
        if (values instanceof Float32Array) {
            result[name] = values;
            continue;
        }
        if (values instanceof Float64Array) {
            result[name] = Float32Array.from(values);
            continue;
        }
        result[name] = Float32Array.from(values as ArrayLike<number>);
    }
    return result;
};

const hashCacheKey = (ownerClusterId: string, objectKey: string): string =>
    createHash('sha256').update(`${ownerClusterId}::${objectKey}`).digest('hex');

const estimateFrameBytes = (frame: TrajectoryFrameData): number => {
    let total = frame.positions.byteLength + frame.types.byteLength + (frame.ids?.byteLength ?? 0);
    for (const values of Object.values(frame.properties)) {
        total += values.byteLength;
    }
    return total;
};

const computeBbox = (positions: Float32Array): [number, number, number, number, number, number] => {
    if (positions.length === 0) return [0, 0, 0, 0, 0, 0];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < positions.length; index += 3) {
        const x = positions[index];
        const y = positions[index + 1];
        const z = positions[index + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }

    return [minX, minY, minZ, maxX, maxY, maxZ];
};

const getNumericValue = (value: unknown): number => {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return 0;
    return Number(value);
};

@Service('trajectoryFrameStore')
export class ParquetTrajectoryFrameStore implements TrajectoryFrameStore {
    private readonly frameCache = new Map<string, CachedFrame>();
    private readonly localParquetPromises = new Map<string, Promise<string>>();
    private frameCacheBytes = 0;

    public constructor(private readonly objectStore: ClusterObjectStore) {}

    public async ingest(input: TrajectoryFrameStoreIngestInput): Promise<TrajectoryFrameStoreIngestResult> {
        if (input.frames.length === 0) {
            throw new Error(`parquet ingest requested with empty frame list for trajectoryId=${input.trajectoryId}`);
        }

        return withNativeProcessingTempDir('trajectory-parquet-ingest', async (tempDirectory) => {
            const outputPath = path.join(tempDirectory, `${input.trajectoryId}.parquet`);
            const customProperties = normalizeCustomPropertyNames(input.customProperties);
            const connection = await DuckDBConnection.create();

            try {
                await this.createFramesTable(connection, customProperties);
                const appender = await connection.createAppender('frames');
                try {
                    const sortedFrames = [...input.frames].sort((a, b) => a.timestep - b.timestep);
                    for (const frame of sortedFrames) {
                        const parsed = readFrameFromFile(frame.dumpPath, customProperties);
                        this.appendFrame(appender, frame.timestep, parsed, customProperties);
                    }
                } finally {
                    appender.closeSync();
                }

                await connection.run(
                    `COPY (SELECT * FROM frames ORDER BY timestep, atom_index) TO ${sqlString(outputPath)} ` +
                    '(FORMAT PARQUET, COMPRESSION ZSTD)'
                );
            } finally {
                connection.closeSync();
            }

            const stat = await fs.stat(outputPath);
            const objectKey = toTrajectoryParquetObjectKey(input.trajectoryId);

            await this.objectStore.putObjectStream({
                ownerClusterId: input.ownerClusterId,
                bucket: ObjectBucketName.Trajectories,
                objectKey,
                stream: createReadStream(outputPath),
                size: stat.size,
                metadata: {
                    'Content-Type': 'application/vnd.apache.parquet',
                    'x-trajectory-format': 'parquet',
                    'x-trajectory-schema-version': '1',
                    'x-trajectory-frame-count': String(input.frames.length)
                }
            });

            this.invalidateCaches(input.ownerClusterId, input.trajectoryId);

            return {
                objectKey,
                frameCount: input.frames.length,
                size: stat.size,
                bucket: ObjectBucketName.Trajectories
            };
        });
    }

    public async readFrame(input: TrajectoryFrameLookupInput): Promise<TrajectoryFrameData> {
        const cacheKey = this.buildFrameCacheKey(input);
        const cached = this.frameCache.get(cacheKey);
        if (cached) {
            this.frameCache.delete(cacheKey);
            this.frameCache.set(cacheKey, cached);
            return cached.frame;
        }

        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveLocalParquet(input.ownerClusterId, input.trajectoryId);
            connection = await DuckDBConnection.create();
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(parquetPath)}) ` +
                'WHERE timestep = $timestep ORDER BY atom_index',
                { timestep: BigInt(input.timestep) }
            );
            const rows = reader.getRowObjectsJS();
            if (rows.length === 0) {
                throw new Error(`parquet timestep not present: ${input.timestep}`);
            }
            const frame = this.rowsToFrame(input.timestep, rows);
            this.putFrameCache(cacheKey, frame);
            return frame;
        } catch (error) {
            throw this.rethrowNotFound(error, input);
        } finally {
            connection?.closeSync();
        }
    }

    private async createFramesTable(connection: DuckDBConnection, customProperties: string[]): Promise<void> {
        const propertyColumns = customProperties
            .map((property) => `${quoteIdentifier(property)} FLOAT`)
            .join(', ');
        await connection.run(
            'CREATE TABLE frames (' +
            'timestep BIGINT NOT NULL, ' +
            'atom_index UINTEGER NOT NULL, ' +
            'id UINTEGER, ' +
            'type USMALLINT NOT NULL, ' +
            'x FLOAT NOT NULL, ' +
            'y FLOAT NOT NULL, ' +
            'z FLOAT NOT NULL' +
            (propertyColumns ? `, ${propertyColumns}` : '') +
            ')'
        );
    }

    private appendFrame(
        appender: Awaited<ReturnType<DuckDBConnection['createAppender']>>,
        timestep: number,
        parsed: NativeParseResult,
        customProperties: string[]
    ): void {
        const atomCount = parsed.positions.length / 3;
        const properties = toFloat32PropertyMap(parsed.properties) ?? {};

        for (let atomIndex = 0; atomIndex < atomCount; atomIndex++) {
            appender.appendBigInt(BigInt(timestep));
            appender.appendUInteger(atomIndex);

            if (parsed.ids) {
                appender.appendUInteger(Number(parsed.ids[atomIndex]));
            } else {
                appender.appendNull();
            }

            appender.appendUSmallInt(parsed.types[atomIndex]);
            appender.appendFloat(parsed.positions[atomIndex * 3]);
            appender.appendFloat(parsed.positions[atomIndex * 3 + 1]);
            appender.appendFloat(parsed.positions[atomIndex * 3 + 2]);

            for (const property of customProperties) {
                const values = properties[property];
                if (values) {
                    appender.appendFloat(values[atomIndex]);
                } else {
                    appender.appendNull();
                }
            }

            appender.endRow();
        }
    }

    private rowsToFrame(timestep: number, rows: Record<string, unknown>[]): TrajectoryFrameData {
        const atomCount = rows.length;
        const positions = new Float32Array(atomCount * 3);
        const types = new Uint16Array(atomCount);
        const ids = new Uint32Array(atomCount);
        let hasIds = false;
        const propertyNames = Object.keys(rows[0]).filter((name) => !BASE_COLUMN_SET.has(name));
        const properties = Object.fromEntries(
            propertyNames.map((name) => [name, new Float32Array(atomCount)])
        ) as Record<string, Float32Array>;

        for (let index = 0; index < atomCount; index++) {
            const row = rows[index];
            positions[index * 3] = getNumericValue(row.x);
            positions[index * 3 + 1] = getNumericValue(row.y);
            positions[index * 3 + 2] = getNumericValue(row.z);
            types[index] = getNumericValue(row.type);

            if (row.id !== null && row.id !== undefined) {
                ids[index] = getNumericValue(row.id);
                hasIds = true;
            }

            for (const property of propertyNames) {
                properties[property][index] = getNumericValue(row[property]);
            }
        }

        return {
            timestep,
            atomCount,
            positions,
            types,
            ids: hasIds ? ids : undefined,
            properties,
            frameBbox: computeBbox(positions)
        };
    }

    private async resolveLocalParquet(ownerClusterId: string, trajectoryId: string): Promise<string> {
        const objectKey = toTrajectoryParquetObjectKey(trajectoryId);
        const cacheKey = `${ownerClusterId}::${objectKey}`;
        const existing = this.localParquetPromises.get(cacheKey);
        if (existing) return existing;

        const promise = this.downloadParquetIfNeeded(ownerClusterId, objectKey);
        this.localParquetPromises.set(cacheKey, promise);
        try {
            return await promise;
        } finally {
            this.localParquetPromises.delete(cacheKey);
        }
    }

    private async downloadParquetIfNeeded(ownerClusterId: string, objectKey: string): Promise<string> {
        await fs.mkdir(DAEMON_PATHS.trajectoryParquetCache, { recursive: true });
        const cacheId = hashCacheKey(ownerClusterId, objectKey);
        const filePath = path.join(DAEMON_PATHS.trajectoryParquetCache, `${cacheId}.parquet`);
        const signaturePath = `${filePath}.signature`;

        const head = await this.objectStore.head(ownerClusterId, ObjectBucketName.Trajectories, objectKey);
        const signature = head.etag
            ?? `${head.contentLength ?? 0}:${head.lastModified?.getTime() ?? 0}`;

        try {
            const [existingSignature] = await Promise.all([
                fs.readFile(signaturePath, 'utf8'),
                fs.access(filePath)
            ]);
            if (existingSignature === signature) {
                return filePath;
            }
        } catch {
            // Cache miss; fall through and refresh from object storage.
        }

        const response = await this.objectStore.getStream(
            ownerClusterId,
            ObjectBucketName.Trajectories,
            objectKey,
            { skipMetadata: true }
        );
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await pipeline(response.stream, createWriteStream(tempPath));
        await fs.rename(tempPath, filePath);
        await fs.writeFile(signaturePath, signature);
        logger.debug(`@trajectory-parquet-store: cached ${objectKey} at ${filePath}`);
        return filePath;
    }

    private invalidateCaches(ownerClusterId: string, trajectoryId: string): void {
        const objectKey = toTrajectoryParquetObjectKey(trajectoryId);
        const cacheKeyPrefix = `${ownerClusterId}::${trajectoryId}::`;
        this.localParquetPromises.delete(`${ownerClusterId}::${objectKey}`);
        for (const key of [...this.frameCache.keys()]) {
            if (key.startsWith(cacheKeyPrefix)) {
                const cached = this.frameCache.get(key);
                if (cached) this.frameCacheBytes -= cached.bytes;
                this.frameCache.delete(key);
            }
        }
    }

    private buildFrameCacheKey(input: TrajectoryFrameLookupInput): string {
        return `${input.ownerClusterId}::${input.trajectoryId}::${input.timestep}`;
    }

    private putFrameCache(key: string, frame: TrajectoryFrameData): void {
        const bytes = estimateFrameBytes(frame);
        this.frameCache.set(key, { frame, bytes });
        this.frameCacheBytes += bytes;

        while (this.frameCache.size > PARQUET_CACHE_MAX_FRAMES) {
            const oldest = this.frameCache.keys().next().value;
            if (!oldest) break;
            const cached = this.frameCache.get(oldest);
            if (cached) this.frameCacheBytes -= cached.bytes;
            this.frameCache.delete(oldest);
        }
    }

    private rethrowNotFound(error: unknown, input: TrajectoryFrameLookupInput): Error {
        if (isObjectNotFoundError(error)) {
            const notFound = new Error(
                `Parquet trajectory object not found: trajectoryId=${input.trajectoryId}, timestep=${input.timestep}, ` +
                `ownerClusterId=${input.ownerClusterId}. The trajectory may not have been ingested yet.`
            );
            notFound.name = 'ParquetTrajectoryNotFoundError';
            return notFound;
        }
        if (error instanceof Error) return error;
        return new Error(String(error));
    }
}
