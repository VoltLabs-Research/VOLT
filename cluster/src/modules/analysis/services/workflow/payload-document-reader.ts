import { DuckDBConnection } from '@duckdb/node-api';
import path from 'node:path';
import { logger } from '@shared/infrastructure/logger';
import { quoteIdentifier, sqlString } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import type { PerAtomParquetSource } from '@modules/plugin/services/properties/PluginAtomProperties';
import type { JsonObject } from '@shared/contracts/types/json';
import type { MeshParquetSource, SubListingBatchSource } from '@shared/contracts/types/workflow-exposure';
import { PARQUET_SOURCE_KEY } from '@shared/contracts/types/workflow-exposure';


const INLINE_PAYLOAD_LIMIT_BYTES = 64 * 1024 * 1024;

const INLINE_VALUE_LIMIT_BYTES = 32 * 1024 * 1024;

const SUB_LISTING_PAGE_ROWS = 20_000;

const PER_ATOM_JSON_PATH = '$."per-atom-properties"';

const MESH_EXPORTER = 'MeshExporter';
const ATOMISTIC_EXPORTER = 'AtomisticExporter';

const ATOM_COLOR_KEYS = ['color', 'structure_color', 'rgb', 'base_color'] as const;

interface LargePayloadDocument {
    listing: JsonObject | null;
    subListingNames: string[];
    subListingSources: SubListingBatchSource[];
    perAtomSource: PerAtomParquetSource | null;
    exportData: JsonObject | null;
}

export interface PayloadDocumentReadOptions {
    skipSubListings?: boolean;
}

const readSingleValue = async (
    connection: DuckDBConnection,
    sql: string,
    column: string
): Promise<unknown> => {
    const reader = await connection.runAndReadAll(sql);
    return reader.getRowObjectsJS()[0]?.[column];
};

export const measurePayloadBytes = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<number> => {
    const value = await readSingleValue(
        connection,
        `SELECT MAX(strlen(payload)) AS bytes FROM read_parquet(${sqlString(filePath)})`,
        'bytes'
    );
    return Number(value ?? 0);
};

export const isPayloadTooLargeForJs = (bytes: number): boolean => bytes > INLINE_PAYLOAD_LIMIT_BYTES;

const PAYLOAD_TABLE = '__volt_payload_document';

const materializePayloadDocument = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<void> => {
    await connection.run(
        `CREATE OR REPLACE TEMP TABLE ${PAYLOAD_TABLE} AS `
        + `SELECT payload FROM read_parquet(${sqlString(filePath)}) LIMIT 1`
    );
};

const escapeJsonPathSegment = (key: string): string => key.replace(/"/g, '\\"');

const jsonPath = (...segments: string[]): string =>
    `$${segments.map((segment) => `."${escapeJsonPathSegment(segment)}"`).join('')}`;

const measureJsonPathBytes = async (
    connection: DuckDBConnection,
    filePath: string,
    valuePath: string
): Promise<number> => {
    const value = await readSingleValue(
        connection,
        `SELECT strlen(CAST(json_extract(payload, ${sqlString(valuePath)}) AS VARCHAR)) AS bytes `
        + `FROM ${PAYLOAD_TABLE}`,
        'bytes'
    );
    return Number(value ?? 0);
};

const parseExtracted = (raw: unknown): unknown => {
    if (typeof raw !== 'string' || raw.length === 0 || raw === 'null') {
        return null;
    }
    return JSON.parse(raw);
};

const extractJson = async (
    connection: DuckDBConnection,
    filePath: string,
    valuePath: string
): Promise<unknown> => {
    const raw = await readSingleValue(
        connection,
        `SELECT CAST(json_extract(payload, ${sqlString(valuePath)}) AS VARCHAR) AS value `
        + `FROM ${PAYLOAD_TABLE}`,
        'value'
    );
    return parseExtracted(raw);
};

const extractJsonIfSmall = async (
    connection: DuckDBConnection,
    filePath: string,
    valuePath: string,
    describe: string
): Promise<unknown> => {
    const bytes = await measureJsonPathBytes(connection, filePath, valuePath);
    if (bytes > INLINE_VALUE_LIMIT_BYTES) {
        logger.warn(
            {
                path: filePath,
                jsonPath: valuePath,
                bytes,
                limitBytes: INLINE_VALUE_LIMIT_BYTES
            },
            `Payload section ${describe} is too large to read as JSON and has no columnar path; skipping it`
        );
        return null;
    }
    return extractJson(connection, filePath, valuePath);
};

const listJsonKeys = async (
    connection: DuckDBConnection,
    filePath: string,
    valuePath: string | null
): Promise<string[]> => {
    const target = valuePath === null ? 'payload' : `json_extract(payload, ${sqlString(valuePath)})`;
    const raw = await readSingleValue(
        connection,
        `SELECT json_keys(${target}) AS keys FROM ${PAYLOAD_TABLE}`,
        'keys'
    );
    return Array.isArray(raw) ? raw.map((key) => String(key)) : [];
};

const jsonTypeAt = async (
    connection: DuckDBConnection,
    filePath: string,
    valuePath: string
): Promise<string | null> => {
    const raw = await readSingleValue(
        connection,
        `SELECT json_type(payload, ${sqlString(valuePath)}) AS kind FROM ${PAYLOAD_TABLE}`,
        'kind'
    );
    return typeof raw === 'string' ? raw.toUpperCase() : null;
};

const jsonArrayLength = async (
    connection: DuckDBConnection,
    filePath: string,
    valuePath: string
): Promise<number> => {
    const raw = await readSingleValue(
        connection,
        `SELECT json_array_length(payload, ${sqlString(valuePath)}) AS length FROM ${PAYLOAD_TABLE}`,
        'length'
    );
    return Number(raw ?? 0);
};

const unnestedArray = (filePath: string, valuePath: string): string =>
    'WITH __items AS ('
    + `SELECT UNNEST(CAST(json_extract(payload, ${sqlString(valuePath)}) AS JSON[])) AS item `
    + `FROM ${PAYLOAD_TABLE}), `
    + '__ordered AS (SELECT ROW_NUMBER() OVER () - 1 AS ordinal, item FROM __items)';

const typedArrayRows = (filePath: string, valuePath: string, itemSchema: string): string =>
    'WITH __parsed AS ('
    + `SELECT from_json(json_extract(payload, ${sqlString(valuePath)}), ${sqlString(`[${itemSchema}]`)}) AS items `
    + `FROM ${PAYLOAD_TABLE}), `
    + '__ordered AS (SELECT UNNEST(items) AS item, generate_subscripts(items, 1) - 1 AS ordinal FROM __parsed)';

const copyToParquet = (projection: string, outputPath: string): string =>
    `COPY (${projection}) TO ${sqlString(outputPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`;

const countParquetRows = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<number> => Number(await readSingleValue(
    connection,
    `SELECT COUNT(*) AS total FROM read_parquet(${sqlString(filePath)})`,
    'total'
) ?? 0);

const flattenPerAtomProperties = async (
    connection: DuckDBConnection,
    filePath: string,
    outputPath: string
): Promise<PerAtomParquetSource | null> => {
    const kind = await jsonTypeAt(connection, filePath, PER_ATOM_JSON_PATH);
    if (kind === null || kind === 'NULL') {
        return null;
    }

    let projection: string;
    if (kind === 'ARRAY') {
        const keys = await listJsonKeys(connection, filePath, `${PER_ATOM_JSON_PATH}[0]`);
        if (keys.length === 0) {
            return null;
        }

        const columns = keys
            .map((key) => `json_extract_string(item, '$."${escapeJsonPathSegment(key)}"') AS ${quoteIdentifier(key)}`)
            .join(', ');
        projection =
            'WITH items AS ('
            + `SELECT UNNEST(CAST(json_extract(payload, ${sqlString(PER_ATOM_JSON_PATH)}) AS JSON[])) AS item `
            + `FROM ${PAYLOAD_TABLE}) `
            + `SELECT ${columns} FROM items`;
    } else if (kind === 'OBJECT') {
        const keys = await listJsonKeys(connection, filePath, PER_ATOM_JSON_PATH);
        if (keys.length === 0) {
            return null;
        }

        const columns = keys
            .map((key) =>
                'UNNEST(CAST(json_extract(payload, '
                + `${sqlString(`${PER_ATOM_JSON_PATH}."${escapeJsonPathSegment(key)}"`)}) AS JSON[])) `
                + `AS ${quoteIdentifier(key)}`)
            .join(', ');
        projection = `SELECT ${columns} FROM ${PAYLOAD_TABLE}`;
    } else {
        return null;
    }

    await connection.run(copyToParquet(
        `SELECT ROW_NUMBER() OVER () - 1 AS atom_index, * FROM (${projection})`,
        outputPath
    ));

    const rowCount = await countParquetRows(connection, outputPath);

    return rowCount > 0 ? {
        filePath: outputPath,
        rowCount
    } : null;
};

const flattenMesh = async (
    connection: DuckDBConnection,
    filePath: string,
    sectionPath: string,
    outputPrefix: string
): Promise<MeshParquetSource | null> => {
    if (await jsonTypeAt(connection, filePath, `${sectionPath}.vertices`) !== 'ARRAY') {
        return null;
    }
    if (await jsonTypeAt(connection, filePath, `${sectionPath}.facets`) !== 'ARRAY') {
        return null;
    }

    const verticesPath = `${outputPrefix}.mesh-vertices.parquet`;
    const facetsPath = `${outputPrefix}.mesh-facets.parquet`;

    await connection.run(copyToParquet(
        `${typedArrayRows(filePath, `${sectionPath}.vertices`, '{"index":"BIGINT","position":"DOUBLE[]"}')} `
        + 'SELECT ordinal AS slot, '
        + 'item.index AS vertex_id, '
        + 'item.position[1] AS x, '
        + 'item.position[2] AS y, '
        + 'item.position[3] AS z '
        + 'FROM __ordered',
        verticesPath
    ));

    await connection.run(copyToParquet(
        `${typedArrayRows(filePath, `${sectionPath}.facets`, '{"vertices":"BIGINT[]"}')} `
        + 'SELECT ordinal AS ord, '
        + 'item.vertices[1] AS a, '
        + 'item.vertices[2] AS b, '
        + 'item.vertices[3] AS c '
        + 'FROM __ordered',
        facetsPath
    ));

    const [vertexCount, facetCount] = await Promise.all([
        countParquetRows(connection, verticesPath),
        countParquetRows(connection, facetsPath)
    ]);
    logger.info(
        {
            path: filePath,
            vertexCount,
            facetCount
        },
        'Flattened payload mesh section to parquet'
    );

    return vertexCount > 0 && facetCount > 0 ? {
        vertices: verticesPath,
        facets: facetsPath
    } : null;
};

const ATOMISTIC_ITEM_SCHEMA =
    `[{"pos":"DOUBLE[]",${ATOM_COLOR_KEYS.map((key) => `"${key}":"DOUBLE[]"`).join(',')}}]`;

const flattenAtomisticExport = async (
    connection: DuckDBConnection,
    filePath: string,
    sectionPath: string,
    outputPath: string
): Promise<string | null> => {
    if (await jsonTypeAt(connection, filePath, sectionPath) !== 'OBJECT') {
        return null;
    }

    await connection.run(copyToParquet(
        'WITH __section AS ('
        + `SELECT CAST(json_extract(payload, ${sqlString(sectionPath)}) AS MAP(VARCHAR, JSON)) AS buckets `
        + `FROM ${PAYLOAD_TABLE}), `
        + '__entries AS ('
        + 'SELECT UNNEST(map_entries(buckets)) AS entry, '
        + 'generate_subscripts(map_entries(buckets), 1) - 1 AS bucket_ordinal '
        + 'FROM __section), '
        + '__parsed AS ('
        + 'SELECT entry.key AS bucket, bucket_ordinal, '
        + `from_json(entry.value, ${sqlString(ATOMISTIC_ITEM_SCHEMA)}) AS items `
        + 'FROM __entries), '
        + '__based AS ('
        + 'SELECT bucket, items, '
        + 'COALESCE(SUM(COALESCE(len(items), 0)) OVER ('
        + 'ORDER BY bucket_ordinal ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS atom_base '
        + 'FROM __parsed), '
        + '__rows AS ('
        + 'SELECT bucket, atom_base, UNNEST(items) AS item, '
        + 'generate_subscripts(items, 1) - 1 AS row_ordinal '
        + 'FROM __based) '
        + 'SELECT bucket, CAST(atom_base + row_ordinal AS BIGINT) AS atom_index, '
        + 'item.pos[1] AS x, item.pos[2] AS y, item.pos[3] AS z, '
        + `${ATOM_COLOR_KEYS.map((key) => `item.${quoteIdentifier(key)} AS ${quoteIdentifier(key)}`).join(', ')} `
        + 'FROM __rows',
        outputPath
    ));

    const summary = await connection.runAndReadAll(
        'SELECT COUNT(*) AS atoms, COUNT(DISTINCT bucket) AS buckets '
        + `FROM read_parquet(${sqlString(outputPath)})`
    );
    const totals = summary.getRowObjectsJS()[0] ?? {};
    const rowCount = Number(totals.atoms ?? 0);

    logger.info(
        {
            path: filePath,
            bucketCount: Number(totals.buckets ?? 0),
            atomCount: rowCount
        },
        'Flattened payload atomistic section to parquet'
    );

    return rowCount > 0 ? outputPath : null;
};

const readExporterSection = async (
    connection: DuckDBConnection,
    filePath: string,
    sectionPath: string,
    exporter: string,
    outputPrefix: string
): Promise<unknown> => {
    if (exporter === MESH_EXPORTER) {
        const mesh = await flattenMesh(connection, filePath, sectionPath, outputPrefix);
        return mesh ? { [PARQUET_SOURCE_KEY]: mesh } : null;
    }

    if (exporter === ATOMISTIC_EXPORTER) {
        const source = await flattenAtomisticExport(
            connection,
            filePath,
            sectionPath,
            `${outputPrefix}.atomistic.parquet`
        );
        return source ? { [PARQUET_SOURCE_KEY]: source } : null;
    }

    return extractJsonIfSmall(connection, filePath, sectionPath, `export.${exporter}`);
};

const readExportKey = async (
    connection: DuckDBConnection,
    filePath: string,
    key: string,
    outputPrefix: string
): Promise<unknown> => {
    const keyPath = jsonPath(key);
    const kind = await jsonTypeAt(connection, filePath, keyPath);

    if (kind === 'ARRAY') {
        const length = await jsonArrayLength(connection, filePath, keyPath);
        const entries: unknown[] = [];
        for (let index = 0; index < length; index += 1) {
            const elementPath = `${keyPath}[${index}]`;
            const exporters = await listJsonKeys(connection, filePath, elementPath);
            const element: JsonObject = {};
            for (const exporter of exporters) {
                const section = await readExporterSection(
                    connection,
                    filePath,
                    `${elementPath}."${escapeJsonPathSegment(exporter)}"`,
                    exporter,
                    `${outputPrefix}.${index}.${exporter}`
                );
                if (section !== null) {
                    element[exporter] = section as JsonObject[string];
                }
            }
            entries.push(element);
        }
        return entries.length > 0 ? entries : null;
    }

    if (kind !== 'OBJECT') {
        return null;
    }

    const exporters = await listJsonKeys(connection, filePath, keyPath);
    const section: JsonObject = {};
    for (const exporter of exporters) {
        const value = await readExporterSection(
            connection,
            filePath,
            `${keyPath}."${escapeJsonPathSegment(exporter)}"`,
            exporter,
            `${outputPrefix}.${exporter}`
        );
        if (value !== null) {
            section[exporter] = value as JsonObject[string];
        }
    }

    return Object.keys(section).length > 0 ? section : null;
};

const streamSubListingRows = (filePath: string, rowCount: number) =>
    async function* readBatches(): AsyncIterable<JsonObject[]> {
        const connection = await DuckDBConnection.create();
        try {
            for (let start = 0; start < rowCount; start += SUB_LISTING_PAGE_ROWS) {
                const reader = await connection.runAndReadAll(
                    `SELECT row_json FROM read_parquet(${sqlString(filePath)}) `
                    + `WHERE ordinal >= ${start} AND ordinal < ${start + SUB_LISTING_PAGE_ROWS} `
                    + 'ORDER BY ordinal'
                );
                const batch: JsonObject[] = [];
                for (const row of reader.getRowObjectsJS()) {
                    const parsed = parseExtracted(row.row_json);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        batch.push(parsed as JsonObject);
                    }
                }
                if (batch.length > 0) {
                    yield batch;
                }
            }
        } finally {
            connection.closeSync();
        }
    };

const flattenSubListing = async (
    connection: DuckDBConnection,
    filePath: string,
    name: string,
    outputPath: string
): Promise<SubListingBatchSource | null> => {
    const entryPath = jsonPath('sub_listings', name);
    const kind = await jsonTypeAt(connection, filePath, entryPath);

    if (kind === 'OBJECT') {
        const value = await extractJsonIfSmall(connection, filePath, entryPath, `sub_listings.${name}`);
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const rows = [value as JsonObject];
        return {
            name,
            rowCount: 1,
            readBatches: async function* readBatches() {
                yield rows;
            }
        };
    }

    if (kind !== 'ARRAY') {
        return null;
    }

    await connection.run(copyToParquet(
        `${unnestedArray(filePath, entryPath)} `
        + 'SELECT ordinal, CAST(item AS VARCHAR) AS row_json FROM __ordered',
        outputPath
    ));

    const rowCount = await countParquetRows(connection, outputPath);
    if (rowCount === 0) {
        return null;
    }

    return {
        name,
        rowCount,
        readBatches: streamSubListingRows(outputPath, rowCount)
    };
};

const readMainListingScalars = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<JsonObject | null> => {
    const listing: JsonObject = {};
    for (const key of await listJsonKeys(connection, filePath, '$.main_listing')) {
        const keyPath = jsonPath('main_listing', key);
        const kind = await jsonTypeAt(connection, filePath, keyPath);
        if (kind === 'OBJECT' || kind === 'ARRAY' || kind === null) {
            continue;
        }
        const value = await extractJson(connection, filePath, keyPath);
        if (value !== null) {
            listing[key] = value as JsonObject[string];
        }
    }
    return Object.keys(listing).length > 0 ? listing : null;
};

export const readLargePayloadDocument = async (
    connection: DuckDBConnection,
    filePath: string,
    workingDirectory: string,
    options: PayloadDocumentReadOptions = {}
): Promise<LargePayloadDocument> => {
    await materializePayloadDocument(connection, filePath);
    try {
        return await readMaterializedDocument(connection, filePath, workingDirectory, options);
    } finally {
        await connection.run(`DROP TABLE IF EXISTS ${PAYLOAD_TABLE}`);
    }
};

const readMaterializedDocument = async (
    connection: DuckDBConnection,
    filePath: string,
    workingDirectory: string,
    options: PayloadDocumentReadOptions
): Promise<LargePayloadDocument> => {
    const topLevelKeys = await listJsonKeys(connection, filePath, null);
    const outputPrefix = path.join(workingDirectory, path.basename(filePath));

    let listing: unknown = null;
    if (topLevelKeys.includes('main_listing')) {
        listing = await extractJsonIfSmall(connection, filePath, '$.main_listing', 'main_listing')
            ?? await readMainListingScalars(connection, filePath);
    }

    const exportData: JsonObject = {};
    for (const key of topLevelKeys) {
        if (key !== 'export' && !key.startsWith('export.')) {
            continue;
        }
        const value = await readExportKey(connection, filePath, key, `${outputPrefix}.${key}`);
        if (value !== null) {
            exportData[key] = value as JsonObject[string];
        }
    }

    const subListingSources: SubListingBatchSource[] = [];
    if (topLevelKeys.includes('sub_listings') && !options.skipSubListings) {
        for (const name of await listJsonKeys(connection, filePath, '$.sub_listings')) {
            const source = await flattenSubListing(
                connection,
                filePath,
                name,
                `${outputPrefix}.sub-listing.${name}.parquet`
            );
            if (source) {
                subListingSources.push(source);
            }
        }
    }

    const perAtomSource = topLevelKeys.includes('per-atom-properties')
        ? await flattenPerAtomProperties(
            connection,
            filePath,
            `${outputPrefix}.per-atom.parquet`
        )
        : null;

    return {
        listing: listing ? { main_listing: listing as JsonObject } : null,
        subListingNames: subListingSources.map((source) => source.name),
        subListingSources,
        perAtomSource,
        exportData: Object.keys(exportData).length > 0 ? exportData : null
    };
};
