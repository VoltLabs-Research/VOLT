import { singleton } from '@shared/application/utilities/singleton';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Worker } from 'node:worker_threads';
import { DuckDBConnection, DuckDBTypeId } from '@duckdb/node-api';

import { DAEMON_PATHS } from '@core/config/paths';
import { logger } from '@shared/infrastructure/logger';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { toTrajectoryFrameError } from '@modules/trajectory/services/storage/trajectory-not-found-error';
import type {
    TrajectoryElementMetadata,
    TrajectoryFrameData,
    TrajectoryFrameLookupInput,
    TrajectoryFramePage,
    TrajectoryPropertyStats,
    TrajectoryFrameRange,
    TrajectoryFrameSource,
    TrajectoryFrameStore,
    TrajectoryFrameStoreIngestInput,
    TrajectoryFrameStoreIngestResult
} from '@shared/contracts/types/trajectory-frame-store';
import type { ColumnDType, TypedColumn } from '@shared/domain/catalog/element-table';
import { DEFAULT_UNITS } from '@shared/domain/catalog/units';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import {
    toTrajectoryParquetObjectKey,
    toTrajectoryElementTableObjectKey
} from '@shared/infrastructure/storage/storage-codec';

const BASE_COLUMN_SET = new Set<string>(['timestep', 'atom_index', 'id', 'type', 'x', 'y', 'z']);
const PARQUET_FRAME_CACHE_BYTES = 512 * 1024 * 1024;

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

const sqlString = (value: string): string =>
    `'${value.replace(/'/g, "''")}'`;

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

interface ParquetFrameRow {
    id: number | null;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: number | null;
}

interface ParquetBuildWorkerInput {
    outputPath: string;
    frames: TrajectoryFrameSource[];
    customProperties?: string[];
}

interface ParquetBuildWorkerMessage {
    ok: boolean;
    result?: TrajectoryElementMetadata;
    error?: {
        name?: string;
        message?: string;
        stack?: string;
    };
}

const runParquetBuildWorker = (input: ParquetBuildWorkerInput): Promise<TrajectoryElementMetadata> => (
    new Promise((resolve, reject) => {
        const worker = new Worker(
            path.join(__dirname, '..', '..', 'workers', 'parquet-ingest-worker.cjs'),
            { workerData: input }
        );

        worker.once('message', (message: ParquetBuildWorkerMessage) => {
            if (message.ok && message.result) {
                resolve(message.result);
                return;
            }

            const error = new Error(message.error?.message ?? 'Parquet ingest worker failed');
            error.name = message.error?.name ?? 'ParquetIngestWorkerError';
            error.stack = message.error?.stack ?? error.stack;
            reject(error);
        });
        worker.once('error', reject);
        worker.once('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Parquet ingest worker exited with code ${code}`));
            }
        });
    })
);

export class ParquetTrajectoryFrameStore implements TrajectoryFrameStore {
    private readonly frameCache = new Map<string, { frame: TrajectoryFrameData; bytes: number }>();
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
            const built = await runParquetBuildWorker({
                outputPath,
                frames: input.frames,
                customProperties: input.customProperties
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

            await this.writeElementMetadata(input.ownerClusterId, input.trajectoryId, built);

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
        const cacheKey = this.frameCacheKey(input);
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
            const rows = reader.getRowObjectsJS() as ParquetFrameRow[];
            if (rows.length === 0) {
                throw new Error(`parquet timestep not present: ${input.timestep}`);
            }
            const frame = this.rowsToFrame(input.timestep, rows, reader);
            this.putFrameCache(cacheKey, frame);
            return frame;
        } catch (error) {
            throw toTrajectoryFrameError(error, input);
        } finally {
            connection?.closeSync();
        }
    }

    /** Cache-only lookup: lets a caller prefer a resident frame over any read. */
    public peekFrame(input: TrajectoryFrameLookupInput): TrajectoryFrameData | null {
        const cached = this.frameCache.get(this.frameCacheKey(input));
        return cached ? cached.frame : null;
    }

    /**
     * Reads one contiguous run of atoms instead of the whole frame.
     *
     * `atom_index` is dense and zero-based within a timestep, so a range predicate is
     * exactly the slice the caller wants — and unlike `LIMIT/OFFSET` it needs no sort
     * of the frame and lets DuckDB skip row groups outside the range. The result is
     * deliberately not cached: it is a fragment, and storing it under the frame key
     * would make later full-frame reads return a truncated frame.
     */
    public async readFrameRange(
        input: TrajectoryFrameLookupInput,
        range: TrajectoryFrameRange
    ): Promise<TrajectoryFramePage> {
        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveLocalParquet(input.ownerClusterId, input.trajectoryId);
            connection = await DuckDBConnection.create();

            const countReader = await connection.runAndReadAll(
                `SELECT count(*) AS total FROM read_parquet(${sqlString(parquetPath)}) WHERE timestep = $timestep`,
                { timestep: BigInt(input.timestep) }
            );
            const totalAtoms = Number((countReader.getRowObjectsJS()[0] as { total: number | bigint }).total);
            if (totalAtoms === 0) {
                throw new Error(`parquet timestep not present: ${input.timestep}`);
            }

            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(parquetPath)}) ` +
                'WHERE timestep = $timestep AND atom_index >= $startIndex AND atom_index < $endIndex ' +
                'ORDER BY atom_index',
                {
                    timestep: BigInt(input.timestep),
                    startIndex: BigInt(range.startIndex),
                    endIndex: BigInt(range.endIndexExclusive)
                }
            );
            const rows = reader.getRowObjectsJS() as ParquetFrameRow[];

            return {
                frame: this.rowsToFrame(input.timestep, rows, reader),
                totalAtoms
            };
        } catch (error) {
            throw toTrajectoryFrameError(error, input);
        } finally {
            connection?.closeSync();
        }
    }

    /**
     * min/max without materialising the frame. DuckDB answers this from column
     * statistics or a single scan, where the JS path had to build 10M objects first.
     * Unknown columns come back as null rather than throwing: the caller has a
     * correct, slower path and this is only an optimisation.
     */
    public async readPropertyStats(
        input: TrajectoryFrameLookupInput,
        property: string
    ): Promise<TrajectoryPropertyStats | null> {
        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveLocalParquet(input.ownerClusterId, input.trajectoryId);
            connection = await DuckDBConnection.create();

            const columnName = await this.resolveColumnName(connection, parquetPath, property);
            if (!columnName) {
                return null;
            }

            const quoted = `"${columnName.replace(/"/g, '""')}"`;
            const reader = await connection.runAndReadAll(
                `SELECT min(${quoted}) AS lo, max(${quoted}) AS hi ` +
                `FROM read_parquet(${sqlString(parquetPath)}) WHERE timestep = $timestep`,
                { timestep: BigInt(input.timestep) }
            );
            const row = reader.getRowObjectsJS()[0] as { lo: number | bigint | null; hi: number | bigint | null };
            if (row.lo === null || row.hi === null) {
                return {
                    min: 0,
                    max: 0,
                    dtype: INTEGER_TYPE_IDS.has(reader.columnTypeId(0)) ? 'i32' : 'f32'
                };
            }

            return {
                min: Number(row.lo),
                max: Number(row.hi),
                dtype: INTEGER_TYPE_IDS.has(reader.columnTypeId(0)) ? 'i32' : 'f32'
            };
        } catch {
            /* Any failure here just means the frame path answers instead. */
            return null;
        } finally {
            connection?.closeSync();
        }
    }

    /** Parquet columns are matched case-insensitively, the way callers name properties. */
    private async resolveColumnName(
        connection: DuckDBConnection,
        parquetPath: string,
        property: string
    ): Promise<string | null> {
        const reader = await connection.runAndReadAll(
            `SELECT * FROM read_parquet(${sqlString(parquetPath)}) LIMIT 0`
        );
        const wanted = property.toLowerCase();
        for (let index = 0; index < reader.columnCount; index++) {
            const name = reader.columnName(index);
            if (name.toLowerCase() === wanted) {
                return name;
            }
        }

        return null;
    }

    public async readElementMetadata(input: { trajectoryId: string; ownerClusterId: string }): Promise<TrajectoryElementMetadata> {
        const cacheKey = `${input.ownerClusterId}::${input.trajectoryId}`;
        const cached = this.elementMetadataCache.get(cacheKey);
        if (cached) return cached;

        const response = await this.objectStore.getStream(
            input.ownerClusterId,
            ObjectBucketName.Trajectories,
            toTrajectoryElementTableObjectKey(input.trajectoryId),
            { skipMetadata: true }
        );
        const chunks: Buffer[] = [];
        for await (const chunk of response.stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const sidecar = JSON.parse(Buffer.concat(chunks).toString('utf8')) as TrajectoryElementMetadata;
        const metadata: TrajectoryElementMetadata = {
            units: sidecar.units ?? DEFAULT_UNITS,
            elementTable: sidecar.elementTable ?? []
        };
        this.elementMetadataCache.set(cacheKey, metadata);
        return metadata;
    }

    private frameCacheKey(input: TrajectoryFrameLookupInput): string {
        return `${input.ownerClusterId}::${input.trajectoryId}::${input.timestep}`;
    }

    private rowsToFrame(
        timestep: number,
        rows: ParquetFrameRow[],
        reader: { columnCount: number; columnName(i: number): string; columnTypeId(i: number): DuckDBTypeId }
    ): TrajectoryFrameData {
        const atomCount = rows.length;
        const positions = new Float32Array(atomCount * 3);
        const types = new Uint16Array(atomCount);
        const ids = new Uint32Array(atomCount);
        let hasIds = false;
        const propertyNames: string[] = [];
        const properties: Record<string, TypedColumn> = {};

        for (let index = 0; index < reader.columnCount; index++) {
            const name = reader.columnName(index);
            if (BASE_COLUMN_SET.has(name)) continue;
            const dtype: ColumnDType = INTEGER_TYPE_IDS.has(reader.columnTypeId(index)) ? 'i32' : 'f32';
            propertyNames.push(name);
            properties[name] = {
                dtype,
                values: dtype === 'i32' ? new Int32Array(atomCount) : new Float32Array(atomCount)
            };
        }

        for (let index = 0; index < atomCount; index++) {
            const row = rows[index];
            positions[index * 3] = row.x;
            positions[index * 3 + 1] = row.y;
            positions[index * 3 + 2] = row.z;
            types[index] = row.type;

            if (row.id !== null) {
                ids[index] = row.id;
                hasIds = true;
            }

            for (const property of propertyNames) {
                properties[property].values[index] = row[property] ?? 0;
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
        metadata: TrajectoryElementMetadata
    ): Promise<void> {
        await this.objectStore.putObject({
            ownerClusterId,
            bucket: ObjectBucketName.Trajectories,
            objectKey: toTrajectoryElementTableObjectKey(trajectoryId),
            body: Buffer.from(JSON.stringify(metadata), 'utf8'),
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
        const cacheId = createHash('sha256').update(`${ownerClusterId}::${objectKey}`).digest('hex');
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
        } catch { /* no usable cache entry; fall through and re-download */ }

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

    private putFrameCache(key: string, frame: TrajectoryFrameData): void {
        let bytes = frame.positions.byteLength + frame.types.byteLength + (frame.ids?.byteLength ?? 0);
        for (const property of Object.values(frame.properties)) {
            bytes += property.values.byteLength;
        }
        this.frameCache.set(key, {
 frame, bytes 
});
        this.frameCacheBytes += bytes;

        while (this.frameCacheBytes > PARQUET_FRAME_CACHE_BYTES && this.frameCache.size > 1) {
            const oldest = this.frameCache.keys().next().value;
            if (!oldest) break;
            const evicted = this.frameCache.get(oldest);
            this.frameCache.delete(oldest);
            if (evicted) this.frameCacheBytes -= evicted.bytes;
        }
    }
}

export const getTrajectoryFrameStore = singleton((): ParquetTrajectoryFrameStore => new ParquetTrajectoryFrameStore(getObjectStore()));
