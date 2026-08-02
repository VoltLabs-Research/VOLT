import { singleton } from '@shared/application/utilities/singleton';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DuckDBConnection } from '@duckdb/node-api';

import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type { FlatAtomProperties } from '@modules/plugin/services/properties/PluginAtomProperties';
import type {
    ModifierScalarValues,
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
import {
    ExposureParquetCache,
    extractExposureId
} from '@modules/plugin/services/properties/ExposureParquetCache';
import {
    BASE_COLUMNS,
    getRowCount,
    inferPropertyColumns,
    listPropertyColumnNames,
    toFiniteNumber
} from '@modules/plugin/services/properties/parquet-property-schema';
import {
    PROPERTIES_TABLE_NAME,
    appendProperties,
    createPropertiesTable
} from '@modules/plugin/services/properties/parquet-property-appender';
import {
    rowsToAtomProperties,
    rowsToFloat32ByAtomId,
    rowsToStringByAtomId,
    toPluginPropertyType
} from '@modules/plugin/services/properties/duckdb-row-mapping';
import {
    quoteIdentifier,
    sqlString
} from '@modules/plugin/services/properties/duckdb-sql-escaping';
import {
    type ExposurePropertyRows,
    mergeExposureRows
} from '@modules/plugin/services/properties/exposure-property-merge';

export class ParquetPluginPropertyStore implements PluginPropertyStore {
    private readonly parquetCache: ExposureParquetCache;

    public constructor(private readonly objectStore: ClusterObjectStore) {
        this.parquetCache = new ExposureParquetCache(objectStore);
    }

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
                input.entityKind
            );
            const outputPath = path.join(tempDirectory, `${createHash('sha1').update(objectKey).digest('hex')}.parquet`);
            const connection = await DuckDBConnection.create();

            try {
                await createPropertiesTable(connection, columns);
                const appender = await connection.createAppender(PROPERTIES_TABLE_NAME);
                try {
                    appendProperties(appender, input.timestep, rows, columns);
                } finally {
                    appender.closeSync();
                }

                await connection.run(
                    `COPY (SELECT * FROM ${PROPERTIES_TABLE_NAME} ORDER BY atom_index) TO ${sqlString(outputPath)} ` +
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

            this.parquetCache.invalidate(input.ownerClusterId, objectKey);

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
        try {
            const parquetPath = request.timestep === undefined
                ? await this.parquetCache.resolveAnyExposureFile(request)
                : await this.parquetCache.resolveExposureFile({
                    ...request,
                    timestep: request.timestep
                });
            if (!parquetPath) return [];

            return await this.readRows(
                `DESCRIBE SELECT * FROM read_parquet(${sqlString(parquetPath)})`,
                (rows) => rows
                    .map((row) => ({
                        name: String(row.column_name ?? row.name ?? ''),
                        type: toPluginPropertyType(row.column_type ?? row.type)
                    }))
                    .filter((schema) => schema.name.length > 0 && !BASE_COLUMNS.has(schema.name))
            );
        } catch {
            return [];
        }
    }

    public getModifierValues(request: PluginModifierValuesRequest): Promise<Float32Array | null> {
        return this.queryExposure(
            request,
            (parquetPath) => `SELECT id, TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE) AS value `
                + `FROM read_parquet(${sqlString(parquetPath)}) WHERE id IS NOT NULL ORDER BY id`,
            rowsToFloat32ByAtomId,
            null
        );
    }

    public async getModifierScalarValues(request: PluginModifierValuesRequest): Promise<ModifierScalarValues | null> {
        if (await this.isStringProperty(request)) {
            return this.queryExposure<ModifierScalarValues | null>(
                request,
                (parquetPath) => `SELECT id, ${quoteIdentifier(request.property)} AS value `
                    + `FROM read_parquet(${sqlString(parquetPath)}) WHERE id IS NOT NULL ORDER BY id`,
                (rows) => ({
                    type: 'string',
                    values: rowsToStringByAtomId(rows)
                }),
                null
            );
        }

        const values = await this.getModifierValues(request);
        return values ? {
            type: 'number',
            values
        } : null;
    }

    public async getModifierStats(request: PluginModifierValuesRequest): Promise<ModifierStats | null> {
        if (await this.isStringProperty(request)) {
            return null;
        }

        return this.queryExposure(
            request,
            (parquetPath) => `SELECT MIN(TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE)) AS min, `
                + `MAX(TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE)) AS max `
                + `FROM read_parquet(${sqlString(parquetPath)})`,
            ([row]) => {
                const min = toFiniteNumber(row?.min);
                const max = toFiniteNumber(row?.max);
                return min === null || max === null ? null : {
                    min,
                    max
                };
            },
            null
        );
    }

    public async getModifierUniqueValues(request: PluginModifierUniqueValuesRequest): Promise<Array<number | string>> {
        const maxValues = Math.max(1, Math.min(1000, request.maxValues ?? 100));
        const isString = await this.isStringProperty(request);
        const valueExpression = isString
            ? quoteIdentifier(request.property)
            : `TRY_CAST(${quoteIdentifier(request.property)} AS DOUBLE)`;

        return this.queryExposure<Array<number | string>>(
            request,
            (parquetPath) => `SELECT DISTINCT ${valueExpression} AS value `
                + `FROM read_parquet(${sqlString(parquetPath)}) `
                + `WHERE ${valueExpression} IS NOT NULL `
                + `ORDER BY value LIMIT ${maxValues}`,
            (rows) => (isString
                ? rows
                    .map((row) => String(row.value ?? ''))
                    .filter((value) => value.length > 0)
                : rows
                    .map((row) => toFiniteNumber(row.value))
                    .filter((value): value is number => value !== null)),
            []
        );
    }

    public buildPluginIndexForAtomIds(request: PluginAtomIndexRequest): Promise<PluginAtomIndex | null> {
        // Ids are inlined into the statement, so only whole non-negative ids are accepted.
        const targetIds = Array.from(new Set(
            request.targetIds.filter((id) => Number.isInteger(id) && id >= 0)
        ));
        if (targetIds.length === 0) return Promise.resolve(null);

        return this.queryExposure(
            request,
            (parquetPath) => `SELECT * FROM read_parquet(${sqlString(parquetPath)}) `
                + `WHERE id IN (${targetIds.join(',')}) ORDER BY id`,
            (rows) => {
                const index: PluginAtomIndex = {};
                for (const atom of rowsToAtomProperties(rows)) {
                    if (atom.id === undefined) continue;
                    index[Number(atom.id)] = atom;
                }
                return Object.keys(index).length > 0 ? index : null;
            },
            null
        );
    }

    public async getAnalysisAllPerAtomData(
        request: PluginAnalysisAllAtomsRequest
    ): Promise<PluginAnalysisAllAtomsResponse> {
        const keys = await this.parquetCache.listAnalysisObjectKeys(
            request.ownerClusterId,
            request.trajectoryId,
            request.analysisId
        );
        const exposures: ExposurePropertyRows[] = [];

        for (const objectKey of keys) {
            if (!objectKey.endsWith(`/timestep-${request.timestep}.parquet`)) {
                continue;
            }

            const exposureId = extractExposureId(request.trajectoryId, request.analysisId, objectKey);
            if (!exposureId) continue;

            const rows = await this.queryExposure<FlatAtomProperties[] | null>(
                {
                    ...request,
                    exposureId
                },
                (parquetPath) => `SELECT * FROM read_parquet(${sqlString(parquetPath)}) ORDER BY atom_index`,
                rowsToAtomProperties,
                null
            );
            if (!rows || rows.length === 0) continue;

            const propertyNames = listPropertyColumnNames(rows);
            if (propertyNames.length === 0) continue;

            exposures.push({
                exposureId,
                propertyNames,
                rows
            });
        }

        if (exposures.length === 0) {
            return {
                propertyNames: [],
                atoms: []
            };
        }

        return mergeExposureRows(exposures, request.atomIds);
    }

    private async isStringProperty(request: PluginModifierValuesRequest): Promise<boolean> {
        const schemas = await this.discoverPerAtomPropertySchemas(request);
        return schemas.some((schema) => schema.name === request.property && schema.type === 'string');
    }

    /** Every exposure read resolves the parquet file, runs one statement, and degrades to a fallback. */
    private async queryExposure<T>(
        request: PluginModifierAnalysisRequest,
        buildSql: (parquetPath: string) => string,
        mapRows: (rows: Record<string, unknown>[]) => T,
        fallback: T
    ): Promise<T> {
        try {
            const parquetPath = await this.parquetCache.resolveExposureFile(request);
            return await this.readRows(buildSql(parquetPath), mapRows);
        } catch {
            return fallback;
        }
    }

    private async readRows<T>(sql: string, mapRows: (rows: Record<string, unknown>[]) => T): Promise<T> {
        const connection = await DuckDBConnection.create();
        try {
            const reader = await connection.runAndReadAll(sql);
            return mapRows(reader.getRowObjectsJS());
        } finally {
            connection.closeSync();
        }
    }
}

export const getPluginPropertyStore = singleton((): ParquetPluginPropertyStore => new ParquetPluginPropertyStore(getObjectStore()));
