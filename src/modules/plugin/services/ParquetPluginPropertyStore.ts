import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { DuckDBConnection } from '@duckdb/node-api';

import { DAEMON_PATHS } from '@core/config/paths';
import { logger } from '@shared/infrastructure/logger';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import {
    type AtomId,
    type AtomProperties,
    type AtomPropertyValue,
    type FlatAtomProperties,
    type PerAtomColumnarData,
    type PerAtomProperties,
    flattenAtomProperties,
    isColumnarPerAtomData,
    normalizeAtomId
} from '@modules/plugin/services/properties/PluginAtomProperties';
import type {
    ModifierStats,
    PluginAnalysisAllAtomsRequest,
    PluginAnalysisAllAtomsResponse,
    PluginAtomIndex,
    PluginAtomIndexRequest,
    PluginModifierAnalysisRequest,
    PluginModifierUniqueValuesRequest,
    PluginModifierValuesRequest,
    PluginPropertyNamesRequest,
    PluginPropertySchema,
    PluginPropertyStore,
    PluginPropertyStoreWriteInput,
    PluginPropertyStoreWriteResult
} from '@modules/plugin/services/properties/PluginPropertyStore';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import { toPluginExposureParquetObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { isRecord } from '@shared/domain/utilities/is-record';

type PropertyColumnType = 'double' | 'varchar';

interface PropertyColumn {
    name: string;
    type: PropertyColumnType;
    sourceName?: string;
    vectorIndex?: number;
}

interface ExposureData {
    exposureId: string;
    propertyNames: string[];
    rows: FlatAtomProperties[];
}

const BASE_COLUMNS = new Set(['timestep', 'atom_index', 'id']);

const quoteIdentifier = (value: string): string =>
    `"${value.replace(/"/g, '""')}"`;

const sqlString = (value: string): string =>
    `'${value.replace(/'/g, "''")}'`;

const hashCacheKey = (ownerClusterId: string, objectKey: string): string =>
    createHash('sha256').update(`${ownerClusterId}::${objectKey}`).digest('hex');

const pluginAnalysisPrefix = (trajectoryId: string, analysisId: string): string =>
    `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`;

const PARQUET_CACHE_MAX_BYTES = Math.max(
    0,
    Number(process.env.DAEMON_PLUGIN_PARQUET_CACHE_MAX_BYTES) || 4 * 1024 * 1024 * 1024
);
const PARQUET_CACHE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const PARQUET_CACHE_MIN_EVICT_AGE_MS = 60 * 1000;

let lastParquetCacheSweepAt = 0;
let parquetCacheSweepInFlight = false;

const normalizePropertyValue = (value: unknown): string | number | boolean | null | undefined => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
    return String(value);
};

const toFiniteNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const toAtomId = (value: AtomPropertyValue | undefined): AtomId | undefined =>
    typeof value === 'number' || typeof value === 'string' ? value : undefined;

const updateColumnType = (
    columns: Map<string, PropertyColumn>,
    name: string,
    value: unknown,
    sourceName?: string,
    vectorIndex?: number
): void => {
    if (value === undefined) return;

    const current = columns.get(name);
    const nextType: PropertyColumnType = current?.type === 'varchar' || (
        value !== null && toFiniteNumber(value) === null
    )
        ? 'varchar'
        : 'double';

    columns.set(name, {
        name,
        type: nextType,
        sourceName: current?.sourceName ?? sourceName,
        vectorIndex: current?.vectorIndex ?? vectorIndex
    });
};

function* validFlatRows(rows: AtomProperties[]): Iterable<AtomProperties> {
    for (const row of rows) {
        if (isRecord(row)) {
            yield row as AtomProperties;
        }
    }
}

const flattenedRowCache = new WeakMap<object, FlatAtomProperties>();

const flattenRowOnce = (row: AtomProperties): FlatAtomProperties => {
    const cached = flattenedRowCache.get(row);
    if (cached) return cached;
    const flattened = flattenAtomProperties(row);
    flattenedRowCache.set(row, flattened);
    return flattened;
};

const inferColumnsFromFlatRows = (rows: Iterable<AtomProperties>): PropertyColumn[] => {
    const columns = new Map<string, PropertyColumn>();
    for (const row of rows) {
        const flattened = flattenRowOnce(row);
        for (const [key, value] of Object.entries(flattened)) {
            if (BASE_COLUMNS.has(key)) continue;
            updateColumnType(columns, key, value);
        }
    }

    return Array.from(columns.values()).sort((left, right) => left.name.localeCompare(right.name));
};

const inferColumnsFromColumnarRows = (rows: PerAtomColumnarData): PropertyColumn[] => {
    const columns = new Map<string, PropertyColumn>();
    for (const [sourceName, values] of Object.entries(rows)) {
        if (sourceName === 'id') continue;
        for (const value of values) {
            if (Array.isArray(value)) {
                for (let index = 0; index < value.length; index += 1) {
                    updateColumnType(columns, `${sourceName}[${index}]`, value[index], sourceName, index);
                }
                continue;
            }

            updateColumnType(columns, sourceName, value, sourceName);
        }
    }

    return Array.from(columns.values()).sort((left, right) => left.name.localeCompare(right.name));
};

const getColumnarRowCount = (rows: PerAtomColumnarData): number => {
    const firstColumn = Object.values(rows)[0];
    return firstColumn?.length ?? 0;
};

const getRowCount = (rows: PerAtomProperties | null | undefined): number => {
    if (!rows) return 0;
    if (Array.isArray(rows)) {
        return rows.reduce((count, row) => count + (isRecord(row) ? 1 : 0), 0);
    }
    if (!isColumnarPerAtomData(rows)) return 0;
    return getColumnarRowCount(rows);
};

const inferPropertyColumns = (rows: PerAtomProperties): PropertyColumn[] => {
    if (Array.isArray(rows)) {
        return inferColumnsFromFlatRows(validFlatRows(rows));
    }
    if (!isColumnarPerAtomData(rows)) {
        return [];
    }
    return inferColumnsFromColumnarRows(rows);
};

const getColumnNames = (rows: Record<string, unknown>[]): string[] => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter((name) => !BASE_COLUMNS.has(name));
};

const normalizeDuckDbColumnType = (value: unknown): PluginPropertySchema['type'] => {
    const type = String(value ?? '').toUpperCase();
    return type.includes('CHAR') || type.includes('STRING') || type.includes('TEXT')
        ? 'string'
        : 'number';
};

const sweepPluginParquetCache = async (): Promise<void> => {
    if (PARQUET_CACHE_MAX_BYTES <= 0) return;
    const now = Date.now();
    if (parquetCacheSweepInFlight || now - lastParquetCacheSweepAt < PARQUET_CACHE_SWEEP_INTERVAL_MS) {
        return;
    }
    parquetCacheSweepInFlight = true;
    lastParquetCacheSweepAt = now;
    try {
        const dir = DAEMON_PATHS.pluginParquetCache;
        const entries = await fs.readdir(dir);
        const stats = await Promise.all(
            entries
                .filter((name) => name.endsWith('.parquet'))
                .map(async (name) => {
                    const filePath = path.join(dir, name);
                    const stat = await fs.stat(filePath);
                    return { filePath, size: stat.size, mtimeMs: stat.mtimeMs };
                })
        );

        let totalBytes = stats.reduce((sum, entry) => sum + entry.size, 0);
        if (totalBytes <= PARQUET_CACHE_MAX_BYTES) return;

        stats.sort((left, right) => left.mtimeMs - right.mtimeMs);
        for (const entry of stats) {
            if (totalBytes <= PARQUET_CACHE_MAX_BYTES) break;
            if (now - entry.mtimeMs < PARQUET_CACHE_MIN_EVICT_AGE_MS) continue;
            await fs.rm(entry.filePath, { force: true });
            await fs.rm(`${entry.filePath}.signature`, { force: true });
            totalBytes -= entry.size;
        }
    } catch {
    } finally {
        parquetCacheSweepInFlight = false;
    }
};

export class ParquetPluginPropertyStore implements PluginPropertyStore {
    private readonly localParquetPromises = new Map<string, Promise<string>>();

    public constructor(private readonly objectStore: ClusterObjectStore) {}

    public async writeExposureProperties(
        input: PluginPropertyStoreWriteInput
    ): Promise<PluginPropertyStoreWriteResult | null> {
        const rows = input.rows;
        const rowCount = getRowCount(rows);
        if (!rows || rowCount === 0) {
            return null;
        }

        const columns = inferPropertyColumns(rows);
        if (columns.length === 0) {
            return null;
        }

        return withNativeProcessingTempDir('plugin-properties-parquet', async (tempDirectory) => {
            const objectKey = toPluginExposureParquetObjectKey(
                input.trajectoryId,
                input.analysisId,
                input.exposureId,
                input.timestep,
                input.entityKind ?? 'atoms'
            );
            const outputPath = path.join(tempDirectory, `${createHash('sha1').update(objectKey).digest('hex')}.parquet`);
            const connection = await DuckDBConnection.create();

            try {
                await this.createPropertiesTable(connection, columns);
                const appender = await connection.createAppender('plugin_properties');
                try {
                    this.appendProperties(appender, input.timestep, rows, columns);
                } finally {
                    appender.closeSync();
                }

                await connection.run(
                    `COPY (SELECT * FROM plugin_properties ORDER BY atom_index) TO ${sqlString(outputPath)} ` +
                    '(FORMAT PARQUET, COMPRESSION ZSTD)'
                );
            } finally {
                connection.closeSync();
            }

            const stat = await fs.stat(outputPath);
            await this.objectStore.putObjectStream({
                ownerClusterId: input.ownerClusterId,
                bucket: ObjectBucketName.Plugins,
                objectKey,
                stream: createReadStream(outputPath),
                size: stat.size,
                metadata: {
                    'Content-Type': 'application/vnd.apache.parquet',
                    'x-plugin-result-format': 'parquet',
                    'x-plugin-result-schema-version': '1',
                    'x-plugin-result-row-count': String(rowCount)
                }
            });

            this.localParquetPromises.delete(`${input.ownerClusterId}::${objectKey}`);

            return {
                objectKey,
                rowCount,
                propertyNames: columns.map((column) => column.name)
            };
        });
    }

    public async discoverPerAtomPropertyNames(request: PluginPropertyNamesRequest): Promise<string[]> {
        return (await this.discoverPerAtomPropertySchemas(request)).map((schema) => schema.name);
    }

    public async discoverPerAtomPropertySchemas(request: PluginPropertyNamesRequest): Promise<PluginPropertySchema[]> {
        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = request.timestep === undefined
                ? await this.resolveFirstExposureLocalParquet(request)
                : await this.resolveExposureLocalParquet({ ...request, timestep: request.timestep });
            if (!parquetPath) return [];
            connection = await DuckDBConnection.create();
            const reader = await connection.runAndReadAll(
                `DESCRIBE SELECT * FROM read_parquet(${sqlString(parquetPath)})`
            );
            return reader.getRowObjectsJS()
                .map((row) => ({
                    name: String(row.column_name ?? row.name ?? ''),
                    type: normalizeDuckDbColumnType(row.column_type ?? row.type)
                }))
                .filter((schema) => schema.name.length > 0 && !BASE_COLUMNS.has(schema.name));
        } catch {
            return [];
        } finally {
            connection?.closeSync();
        }
    }

    public async getModifierAnalysisData(
        request: PluginModifierAnalysisRequest
    ): Promise<FlatAtomProperties[] | null> {
        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveExposureLocalParquet(request);
            connection = await DuckDBConnection.create();
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(parquetPath)}) ORDER BY atom_index`
            );
            return this.rowsToAtomProperties(reader.getRowObjectsJS());
        } catch {
            return null;
        } finally {
            connection?.closeSync();
        }
    }

    public async getModifierValues(request: PluginModifierValuesRequest): Promise<Float32Array | null> {
        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveExposureLocalParquet(request);
            connection = await DuckDBConnection.create();
            const reader = await connection.runAndReadAll(
                `SELECT id, TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE) AS value ` +
                `FROM read_parquet(${sqlString(parquetPath)}) WHERE id IS NOT NULL ORDER BY id`
            );
            return this.rowsToFloat32ByAtomId(reader.getRowObjectsJS());
        } catch {
            return null;
        } finally {
            connection?.closeSync();
        }
    }

    public async getModifierScalarValues(request: PluginModifierValuesRequest) {
        const schema = (await this.discoverPerAtomPropertySchemas(request))
            .find((candidate) => candidate.name === request.property);
        if (schema?.type === 'string') {
            return this.getModifierStringValues(request);
        }

        const values = await this.getModifierValues(request);
        return values ? { type: 'number' as const, values } : null;
    }

    public async getModifierStats(request: PluginModifierValuesRequest): Promise<ModifierStats | null> {
        const schema = (await this.discoverPerAtomPropertySchemas(request))
            .find((candidate) => candidate.name === request.property);
        if (schema?.type === 'string') {
            return null;
        }

        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveExposureLocalParquet(request);
            connection = await DuckDBConnection.create();
            const reader = await connection.runAndReadAll(
                `SELECT MIN(TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE)) AS min, ` +
                `MAX(TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE)) AS max ` +
                `FROM read_parquet(${sqlString(parquetPath)})`
            );
            const [row] = reader.getRowObjectsJS();
            const min = toFiniteNumber(row?.min);
            const max = toFiniteNumber(row?.max);
            return min === null || max === null ? null : { min, max };
        } catch {
            return null;
        } finally {
            connection?.closeSync();
        }
    }

    public async getModifierUniqueValues(request: PluginModifierUniqueValuesRequest): Promise<Array<number | string>> {
        const objectKey = toPluginExposureParquetObjectKey(
            request.trajectoryId,
            request.analysisId,
            request.exposureId,
            request.timestep
        );
        const maxValues = Math.max(1, Math.min(1000, request.maxValues ?? 100));
        const schema = (await this.discoverPerAtomPropertySchemas(request))
            .find((candidate) => candidate.name === request.property);

        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveExposureLocalParquet(request);
            connection = await DuckDBConnection.create();
            if (schema?.type === 'string') {
                const reader = await connection.runAndReadAll(
                    `SELECT DISTINCT ${quoteIdentifier(request.property)} AS value ` +
                    `FROM read_parquet(${sqlString(parquetPath)}) ` +
                    `WHERE ${quoteIdentifier(request.property)} IS NOT NULL ` +
                    `ORDER BY value LIMIT ${maxValues}`
                );
                return reader.getRowObjectsJS()
                    .map((row) => String(row.value ?? ''))
                    .filter((value) => value.length > 0);
            }

            const reader = await connection.runAndReadAll(
                `SELECT DISTINCT TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE) AS value ` +
                `FROM read_parquet(${sqlString(parquetPath)}) ` +
                `WHERE TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE) IS NOT NULL ` +
                `ORDER BY value LIMIT ${maxValues}`
            );
            return reader.getRowObjectsJS()
                .map((row) => toFiniteNumber(row.value))
                .filter((value): value is number => value !== null);
        } catch {
            return [];
        } finally {
            connection?.closeSync();
        }
    }

    private async getModifierStringValues(request: PluginModifierValuesRequest): Promise<{ type: 'string'; values: Array<string | null> } | null> {
        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveExposureLocalParquet(request);
            connection = await DuckDBConnection.create();
            const reader = await connection.runAndReadAll(
                `SELECT id, ${quoteIdentifier(request.property)} AS value ` +
                `FROM read_parquet(${sqlString(parquetPath)}) WHERE id IS NOT NULL ORDER BY id`
            );
            return {
                type: 'string',
                values: this.rowsToStringByAtomId(reader.getRowObjectsJS())
            };
        } catch {
            return null;
        } finally {
            connection?.closeSync();
        }
    }

    public async buildPluginIndexForAtomIds(request: PluginAtomIndexRequest): Promise<PluginAtomIndex | null> {
        const targetIds = Array.from(new Set(
            request.targetIds
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id >= 0)
        ));
        if (targetIds.length === 0) return null;

        let connection: DuckDBConnection | null = null;
        try {
            const parquetPath = await this.resolveExposureLocalParquet(request);
            connection = await DuckDBConnection.create();
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(parquetPath)}) ` +
                `WHERE id IN (${targetIds.join(',')}) ORDER BY id`
            );
            const rows = this.rowsToAtomProperties(reader.getRowObjectsJS());
            const index: PluginAtomIndex = {};
            for (const row of rows) {
                const id = normalizeAtomId(row.id);
                if (id === null) continue;
                index[id] = row;
            }
            return Object.keys(index).length > 0 ? index : null;
        } catch {
            return null;
        } finally {
            connection?.closeSync();
        }
    }

    public async getAnalysisAllPerAtomData(
        request: PluginAnalysisAllAtomsRequest
    ): Promise<PluginAnalysisAllAtomsResponse> {
        const keys = await this.listAllObjectKeys(
            request.ownerClusterId,
            ObjectBucketName.Plugins,
            pluginAnalysisPrefix(request.trajectoryId, request.analysisId)
        );
        const exposureResults: ExposureData[] = [];

        for (const objectKey of keys) {
            if (!objectKey.endsWith(`/timestep-${request.timestep}.parquet`)) {
                continue;
            }

            const exposureId = this.extractExposureId(request.trajectoryId, request.analysisId, objectKey);
            if (!exposureId) continue;

            const rows = await this.getModifierAnalysisData({
                ...request,
                exposureId
            });
            if (!rows || rows.length === 0) continue;

            const propertyNames = getColumnNames(rows as Record<string, unknown>[]);
            if (propertyNames.length === 0) continue;

            exposureResults.push({ exposureId, propertyNames, rows });
        }

        if (exposureResults.length === 0) {
            return { propertyNames: [], atoms: [] };
        }

        return this.mergeExposureRows(exposureResults, request.atomIds);
    }

    private async createPropertiesTable(connection: DuckDBConnection, columns: PropertyColumn[]): Promise<void> {
        const propertyColumns = columns
            .map((column) => `${quoteIdentifier(column.name)} ${column.type === 'double' ? 'DOUBLE' : 'VARCHAR'}`)
            .join(', ');
        await connection.run(
            'CREATE TABLE plugin_properties (' +
            'timestep BIGINT NOT NULL, ' +
            'atom_index UINTEGER NOT NULL, ' +
            'id UBIGINT' +
            (propertyColumns ? `, ${propertyColumns}` : '') +
            ')'
        );
    }

    private appendPropertyRow(
        appender: Awaited<ReturnType<DuckDBConnection['createAppender']>>,
        timestep: number,
        atomIndex: number,
        row: FlatAtomProperties,
        columns: PropertyColumn[]
    ): void {
        appender.appendBigInt(BigInt(timestep));
        appender.appendUInteger(atomIndex);

        const id = normalizeAtomId(row.id);
        if (id === null) {
            appender.appendNull();
        } else {
            appender.appendUBigInt(BigInt(id));
        }

        for (const column of columns) {
            this.appendPropertyValue(appender, column, row[column.name]);
        }

        appender.endRow();
    }

    private appendColumnarPropertyRow(
        appender: Awaited<ReturnType<DuckDBConnection['createAppender']>>,
        timestep: number,
        atomIndex: number,
        rows: PerAtomColumnarData,
        columns: PropertyColumn[]
    ): void {
        appender.appendBigInt(BigInt(timestep));
        appender.appendUInteger(atomIndex);

        const id = normalizeAtomId(toAtomId(rows.id?.[atomIndex]));
        if (id === null) {
            appender.appendNull();
        } else {
            appender.appendUBigInt(BigInt(id));
        }

        for (const column of columns) {
            this.appendPropertyValue(
                appender,
                column,
                this.readColumnarPropertyValue(rows, atomIndex, column)
            );
        }

        appender.endRow();
    }

    private appendProperties(
        appender: Awaited<ReturnType<DuckDBConnection['createAppender']>>,
        timestep: number,
        rows: PerAtomProperties,
        columns: PropertyColumn[]
    ): void {
        if (Array.isArray(rows)) {
            let atomIndex = 0;
            for (const row of validFlatRows(rows)) {
                this.appendPropertyRow(appender, timestep, atomIndex, flattenRowOnce(row), columns);
                atomIndex += 1;
            }
            return;
        }

        if (!isColumnarPerAtomData(rows)) return;
        const rowCount = getColumnarRowCount(rows);
        for (let atomIndex = 0; atomIndex < rowCount; atomIndex += 1) {
            this.appendColumnarPropertyRow(appender, timestep, atomIndex, rows, columns);
        }
    }

    private appendPropertyValue(
        appender: Awaited<ReturnType<DuckDBConnection['createAppender']>>,
        column: PropertyColumn,
        value: unknown
    ): void {
        if (value === null || value === undefined) {
            appender.appendNull();
            return;
        }

        if (column.type === 'double') {
            const numeric = toFiniteNumber(value);
            if (numeric === null) {
                appender.appendNull();
            } else {
                appender.appendDouble(numeric);
            }
            return;
        }

        appender.appendVarchar(String(value));
    }

    private readColumnarPropertyValue(
        rows: PerAtomColumnarData,
        atomIndex: number,
        column: PropertyColumn
    ): AtomPropertyValue | undefined {
        if (!column.sourceName) return undefined;

        const value = rows[column.sourceName]?.[atomIndex];
        if (column.vectorIndex !== undefined) {
            return Array.isArray(value) ? value[column.vectorIndex] : undefined;
        }

        return Array.isArray(value) ? undefined : value;
    }

    private rowsToAtomProperties(rows: Record<string, unknown>[]): FlatAtomProperties[] {
        const propertyNames = getColumnNames(rows);
        return rows.map((row) => {
            const id = normalizeAtomId(row.id as string | number | undefined);
            const atom: FlatAtomProperties = id === null ? {} : { id };

            for (const property of propertyNames) {
                atom[property] = normalizePropertyValue(row[property]);
            }

            return atom;
        });
    }

    private rowsToFloat32ByAtomId(rows: Record<string, unknown>[]): Float32Array | null {
        let maxId = 0;
        for (const row of rows) {
            const id = normalizeAtomId(row.id as string | number | undefined);
            if (id !== null && id > maxId) maxId = id;
        }
        if (maxId <= 0) return null;

        const values = new Float32Array(maxId + 1);
        values.fill(Number.NaN);
        for (const row of rows) {
            const id = normalizeAtomId(row.id as string | number | undefined);
            if (id === null) continue;
            const value = toFiniteNumber(row.value);
            if (value !== null) {
                values[id] = value;
            }
        }

        return values;
    }

    private rowsToStringByAtomId(rows: Record<string, unknown>[]): Array<string | null> {
        let maxId = 0;
        for (const row of rows) {
            const id = normalizeAtomId(row.id as string | number | undefined);
            if (id !== null && id > maxId) maxId = id;
        }
        if (maxId <= 0) return [];

        const values = Array<string | null>(maxId + 1).fill(null);
        for (const row of rows) {
            const id = normalizeAtomId(row.id as string | number | undefined);
            if (id === null || row.value === null || row.value === undefined) continue;
            values[id] = String(row.value);
        }

        return values;
    }

    private mergeExposureRows(
        exposureResults: ExposureData[],
        atomIds?: Set<number>
    ): PluginAnalysisAllAtomsResponse {
        const propertyOccurrences = new Map<string, number>();
        for (const result of exposureResults) {
            for (const property of result.propertyNames) {
                propertyOccurrences.set(property, (propertyOccurrences.get(property) ?? 0) + 1);
            }
        }

        const exposureMappings = new Map<string, Map<string, string>>();
        const allDisplayNames: string[] = [];
        for (const result of exposureResults) {
            const mapping = new Map<string, string>();
            for (const property of result.propertyNames) {
                const displayName = (propertyOccurrences.get(property) ?? 0) > 1
                    ? `${result.exposureId}: ${property}`
                    : property;
                mapping.set(property, displayName);
                allDisplayNames.push(displayName);
            }
            exposureMappings.set(result.exposureId, mapping);
        }

        const mergedAtoms = new Map<number, FlatAtomProperties>();
        for (const result of exposureResults) {
            const mapping = exposureMappings.get(result.exposureId)!;
            for (const row of result.rows) {
                const atomId = normalizeAtomId(row.id);
                if (atomId === null) continue;
                if (atomIds && !atomIds.has(atomId)) continue;

                const existing = mergedAtoms.get(atomId) ?? { id: atomId };
                for (const [source, display] of mapping.entries()) {
                    if (row[source] !== undefined) {
                        existing[display] = row[source];
                    }
                }
                mergedAtoms.set(atomId, existing);
            }
        }

        return {
            propertyNames: allDisplayNames,
            atoms: Array.from(mergedAtoms.values()).sort((left, right) => Number(left.id) - Number(right.id))
        };
    }

    private async resolveExposureLocalParquet(request: PluginModifierAnalysisRequest): Promise<string> {
        const atomsKey = toPluginExposureParquetObjectKey(
            request.trajectoryId,
            request.analysisId,
            request.exposureId,
            request.timestep,
            'atoms'
        );
        try {
            return await this.resolveLocalParquet(request.ownerClusterId, atomsKey);
        } catch {
            const linesKey = toPluginExposureParquetObjectKey(
                request.trajectoryId,
                request.analysisId,
                request.exposureId,
                request.timestep,
                'lines'
            );
            return this.resolveLocalParquet(request.ownerClusterId, linesKey);
        }
    }

    private async resolveFirstExposureLocalParquet(request: PluginPropertyNamesRequest): Promise<string | null> {
        const objectKey = await this.findFirstExposureObjectKey(request);
        if (!objectKey) return null;
        return this.resolveLocalParquet(request.ownerClusterId, objectKey);
    }

    private async findFirstExposureObjectKey(request: PluginPropertyNamesRequest): Promise<string | null> {
        const prefix = `${pluginAnalysisPrefix(request.trajectoryId, request.analysisId)}${request.exposureId}/`;
        const keys = await this.listAllObjectKeys(request.ownerClusterId, ObjectBucketName.Plugins, prefix);
        return keys.find((key) => key.endsWith('.parquet')) ?? null;
    }

    private extractExposureId(trajectoryId: string, analysisId: string, objectKey: string): string | null {
        const prefix = pluginAnalysisPrefix(trajectoryId, analysisId);
        if (!objectKey.startsWith(prefix)) return null;
        const relativePath = objectKey.slice(prefix.length);
        const slashIndex = relativePath.indexOf('/');
        return slashIndex > 0 ? relativePath.slice(0, slashIndex) : null;
    }

    private async listAllObjectKeys(ownerClusterId: string, bucket: ObjectBucketName, prefix: string): Promise<string[]> {
        const keys: string[] = [];
        let cursor: string | undefined;

        do {
            const page = await this.objectStore.list(ownerClusterId, {
                bucket,
                prefix,
                cursor,
                limit: 200
            });
            keys.push(...page.keys);
            cursor = page.nextCursor;
        } while (cursor);

        return keys;
    }

    private async resolveLocalParquet(ownerClusterId: string, objectKey: string): Promise<string> {
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
        await fs.mkdir(DAEMON_PATHS.pluginParquetCache, { recursive: true });
        const cacheId = hashCacheKey(ownerClusterId, objectKey);
        const filePath = path.join(DAEMON_PATHS.pluginParquetCache, `${cacheId}.parquet`);
        const signaturePath = `${filePath}.signature`;

        const head = await this.objectStore.head(ownerClusterId, ObjectBucketName.Plugins, objectKey);
        const signature = head.etag
            ?? `${head.contentLength ?? 0}:${head.lastModified?.getTime() ?? 0}`;

        try {
            const [existingSignature] = await Promise.all([
                fs.readFile(signaturePath, 'utf8'),
                fs.access(filePath)
            ]);
            if (existingSignature === signature) {
                const touchedAt = new Date();
                await fs.utimes(filePath, touchedAt, touchedAt).catch(() => {});
                void sweepPluginParquetCache();
                return filePath;
            }
        } catch {
        }

        const response = await this.objectStore.getStream(
            ownerClusterId,
            ObjectBucketName.Plugins,
            objectKey,
            { skipMetadata: true }
        );
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await pipeline(response.stream, createWriteStream(tempPath));
        await fs.rename(tempPath, filePath);
        await fs.writeFile(signaturePath, signature);
        logger.debug(`@plugin-property-store: cached ${objectKey} at ${filePath}`);
        void sweepPluginParquetCache();
        return filePath;
    }
}

let pluginPropertyStoreInstance: ParquetPluginPropertyStore | null = null;

export const getPluginPropertyStore = (): ParquetPluginPropertyStore => {
    pluginPropertyStoreInstance ??= new ParquetPluginPropertyStore(getObjectStore());
    return pluginPropertyStoreInstance;
};
