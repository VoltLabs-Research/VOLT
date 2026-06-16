import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Worker } from 'node:worker_threads';
import { DuckDBConnection, DuckDBTypeId } from '@duckdb/node-api';

import { DAEMON_PATHS } from '@/core/paths';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { isObjectNotFoundError } from '@/core/storage/contracts/cluster-object-store';
import {
    type ColumnDType,
    type ElementTableEntry,
    type LammpsUnits,
    type TrajectoryElementMetadata,
    type TrajectoryFrameData,
    type TrajectoryFrameLookupInput,
    type TrajectoryFrameStore,
    type TrajectoryFrameStoreIngestInput,
    type TrajectoryFrameStoreIngestResult,
    type TypedColumn
} from '@/modules/trajectory/application/storage/TrajectoryFrameStore';
import { DEFAULT_UNITS } from '@/shared/typed-data';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import {
    toTrajectoryParquetObjectKey,
    toTrajectoryElementTableObjectKey
} from '@/support/serialization/storage-codec';

const BASE_COLUMNS = ['timestep', 'atom_index', 'id', 'type', 'x', 'y', 'z'] as const;
const BASE_COLUMN_SET = new Set<string>(BASE_COLUMNS);
// Frame cache is bounded by retained typed-array bytes, not entry count: a single
// frame's footprint scales with atomCount (positions f32*3 + types u16 + ids u32 +
// one typed array per custom property), so a fixed frame count gives no memory ceiling.
const PARQUET_FRAME_CACHE_BYTES = 512 * 1024 * 1024;

// DuckDB integer logical types map to the i32 daemon dtype (signed 32-bit and narrower);
// everything else (FLOAT/DOUBLE/...) reads as f32. Schema v2 stores i32 columns as
// INTEGER and f32 as FLOAT, so this is an exact round-trip with no value heuristic.
const INTEGER_TYPE_IDS = new Set<DuckDBTypeId>([
    DuckDBTypeId.TINYINT,
    DuckDBTypeId.SMALLINT,
    DuckDBTypeId.INTEGER,
    DuckDBTypeId.BIGINT,
    DuckDBTypeId.UTINYINT,
    DuckDBTypeId.USMALLINT,
    DuckDBTypeId.UINTEGER,
    DuckDBTypeId.UBIGINT
]);

interface CachedFrame {
    frame: TrajectoryFrameData;
    bytes: number;
}

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

const hashCacheKey = (ownerClusterId: string, objectKey: string): string =>
    createHash('sha256').update(`${ownerClusterId}::${objectKey}`).digest('hex');

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

// Retained heap footprint of a cached frame = sum of its typed-array byteLengths.
// Drives byte-based LRU eviction so the cache has a real memory ceiling regardless
// of atomCount or custom-property count.
const frameByteLength = (frame: TrajectoryFrameData): number => {
    let bytes = frame.positions.byteLength + frame.types.byteLength + (frame.ids?.byteLength ?? 0);
    for (const property of Object.values(frame.properties)) {
        bytes += property.values.byteLength;
    }
    return bytes;
};

interface ParquetBuildWorkerInput {
    outputPath: string;
    frames: Array<{ timestep: number; dumpPath: string }>;
    customProperties: string[];
    units?: string;
}

interface ParquetBuildWorkerResult {
    columnDtypes: Record<string, ColumnDType>;
    units: LammpsUnits;
    elementTable: ElementTableEntry[];
}

interface ParquetBuildWorkerMessage {
    ok: boolean;
    result?: ParquetBuildWorkerResult;
    error?: {
        name?: string;
        message?: string;
        stack?: string;
    };
}

interface ElementTableSidecar {
    units: LammpsUnits;
    elementTable: ElementTableEntry[];
}

const parquetBuildWorkerPath = (): string => (
    path.join(__dirname, 'parquet-ingest-worker.cjs')
);

const runParquetBuildWorker = (input: ParquetBuildWorkerInput): Promise<ParquetBuildWorkerResult> => (
    new Promise((resolve, reject) => {
        const worker = new Worker(parquetBuildWorkerPath(), { workerData: input });
        let settled = false;

        const settle = (fn: () => void): void => {
            if (settled) return;
            settled = true;
            fn();
        };

        worker.once('message', (message: ParquetBuildWorkerMessage) => {
            if (message.ok && message.result) {
                settle(() => resolve(message.result as ParquetBuildWorkerResult));
                return;
            }

            const error = new Error(message.error?.message ?? 'Parquet ingest worker failed');
            error.name = message.error?.name ?? 'ParquetIngestWorkerError';
            error.stack = message.error?.stack ?? error.stack;
            settle(() => reject(error));
        });
        worker.once('error', (error) => {
            settle(() => reject(error));
        });
        worker.once('exit', (code) => {
            if (code !== 0) {
                settle(() => reject(new Error(`Parquet ingest worker exited with code ${code}`)));
            }
        });
    })
);

@Service('trajectoryFrameStore')
export class ParquetTrajectoryFrameStore implements TrajectoryFrameStore {
    private readonly frameCache = new Map<string, CachedFrame>();
    private frameCacheBytes = 0;
    private readonly localParquetPromises = new Map<string, Promise<string>>();
    private readonly elementMetadataCache = new Map<string, TrajectoryElementMetadata>();

    public constructor(private readonly objectStore: ClusterObjectStore) {}

    public async ingest(input: TrajectoryFrameStoreIngestInput): Promise<TrajectoryFrameStoreIngestResult> {
        if (input.frames.length === 0) {
            throw new Error(`parquet ingest requested with empty frame list for trajectoryId=${input.trajectoryId}`);
        }

        return withNativeProcessingTempDir('trajectory-parquet-ingest', async (tempDirectory) => {
            const outputPath = path.join(tempDirectory, `${input.trajectoryId}.parquet`);
            const customProperties = normalizeCustomPropertyNames(input.customProperties);
            const built = await runParquetBuildWorker({
                outputPath,
                frames: [...input.frames].sort((a, b) => a.timestep - b.timestep),
                customProperties
            });

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
                    'x-trajectory-schema-version': '2',
                    'x-trajectory-units': built.units,
                    'x-trajectory-frame-count': String(input.frames.length)
                }
            });

            await this.writeElementMetadata(input.ownerClusterId, input.trajectoryId, {
                units: built.units,
                elementTable: built.elementTable
            });

            this.invalidateCaches(input.ownerClusterId, input.trajectoryId);

            return {
                objectKey,
                frameCount: input.frames.length,
                size: stat.size,
                bucket: ObjectBucketName.Trajectories,
                units: built.units,
                elementTable: built.elementTable
            };
        });
    }

    public async readFrame(input: TrajectoryFrameLookupInput): Promise<TrajectoryFrameData> {
        // A null/undefined timestep would otherwise blow up on BigInt(input.timestep)
        // with a cryptic "Cannot convert null to a BigInt". Surface a clear,
        // typed not-found instead so callers (and the UI) get an actionable error.
        if (input.timestep === null || input.timestep === undefined || !Number.isFinite(Number(input.timestep))) {
            throw this.rethrowNotFound(
                new Error(`trajectory frame lookup requires a numeric timestep, got ${String(input.timestep)}`),
                input
            );
        }
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
                { timestep: BigInt(Number(input.timestep)) }
            );
            const rows = reader.getRowObjectsJS();
            if (rows.length === 0) {
                throw new Error(`parquet timestep not present: ${input.timestep}`);
            }
            const columnDtypes = this.readColumnDtypes(reader);
            const frame = this.rowsToFrame(input.timestep, rows, columnDtypes);
            this.putFrameCache(cacheKey, frame);
            return frame;
        } catch (error) {
            throw this.rethrowNotFound(error, input);
        } finally {
            connection?.closeSync();
        }
    }

    public async readElementMetadata(input: { trajectoryId: string; ownerClusterId: string }): Promise<TrajectoryElementMetadata> {
        const cacheKey = `${input.ownerClusterId}::${input.trajectoryId}`;
        const cached = this.elementMetadataCache.get(cacheKey);
        if (cached) return cached;

        const objectKey = toTrajectoryElementTableObjectKey(input.trajectoryId);
        const response = await this.objectStore.getStream(
            input.ownerClusterId,
            ObjectBucketName.Trajectories,
            objectKey,
            { skipMetadata: true }
        );
        const chunks: Buffer[] = [];
        for await (const chunk of response.stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const sidecar = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ElementTableSidecar;
        const metadata: TrajectoryElementMetadata = {
            units: sidecar.units ?? DEFAULT_UNITS,
            elementTable: sidecar.elementTable ?? []
        };
        this.elementMetadataCache.set(cacheKey, metadata);
        return metadata;
    }

    // Map each parquet column to the daemon dtype by its DuckDB logical type. Integer
    // logical types → i32, everything else → f32. No value-shape guessing.
    private readColumnDtypes(reader: { columnCount: number; columnName(i: number): string; columnTypeId(i: number): DuckDBTypeId }): Record<string, ColumnDType> {
        const dtypes: Record<string, ColumnDType> = {};
        for (let index = 0; index < reader.columnCount; index++) {
            const name = reader.columnName(index);
            if (BASE_COLUMN_SET.has(name)) continue;
            dtypes[name] = INTEGER_TYPE_IDS.has(reader.columnTypeId(index)) ? 'i32' : 'f32';
        }
        return dtypes;
    }

    private rowsToFrame(
        timestep: number,
        rows: Record<string, unknown>[],
        columnDtypes: Record<string, ColumnDType>
    ): TrajectoryFrameData {
        const atomCount = rows.length;
        const positions = new Float32Array(atomCount * 3);
        const types = new Uint16Array(atomCount);
        const ids = new Uint32Array(atomCount);
        let hasIds = false;
        const propertyNames = Object.keys(rows[0]).filter((name) => !BASE_COLUMN_SET.has(name));
        const properties: Record<string, TypedColumn> = {};
        for (const name of propertyNames) {
            const dtype = columnDtypes[name] ?? 'f32';
            properties[name] = {
                dtype,
                values: dtype === 'i32' ? new Int32Array(atomCount) : new Float32Array(atomCount)
            };
        }

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
                properties[property].values[index] = getNumericValue(row[property]);
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

    private async writeElementMetadata(
        ownerClusterId: string,
        trajectoryId: string,
        metadata: ElementTableSidecar
    ): Promise<void> {
        const body = Buffer.from(JSON.stringify(metadata), 'utf8');
        await this.objectStore.putObject({
            ownerClusterId,
            bucket: ObjectBucketName.Trajectories,
            objectKey: toTrajectoryElementTableObjectKey(trajectoryId),
            body,
            metadata: { 'Content-Type': 'application/json' }
        });
        this.elementMetadataCache.set(`${ownerClusterId}::${trajectoryId}`, metadata);
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
        this.elementMetadataCache.delete(`${ownerClusterId}::${trajectoryId}`);
        for (const key of [...this.frameCache.keys()]) {
            if (key.startsWith(cacheKeyPrefix)) {
                const evicted = this.frameCache.get(key);
                this.frameCache.delete(key);
                if (evicted) this.frameCacheBytes -= evicted.bytes;
            }
        }
    }

    private buildFrameCacheKey(input: TrajectoryFrameLookupInput): string {
        return `${input.ownerClusterId}::${input.trajectoryId}::${input.timestep}`;
    }

    private putFrameCache(key: string, frame: TrajectoryFrameData): void {
        const bytes = frameByteLength(frame);
        this.frameCache.set(key, { frame, bytes });
        this.frameCacheBytes += bytes;

        while (this.frameCacheBytes > PARQUET_FRAME_CACHE_BYTES && this.frameCache.size > 1) {
            const oldest = this.frameCache.keys().next().value;
            if (!oldest) break;
            const evicted = this.frameCache.get(oldest);
            this.frameCache.delete(oldest);
            if (evicted) this.frameCacheBytes -= evicted.bytes;
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
