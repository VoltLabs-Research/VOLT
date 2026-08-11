import { DuckDBConnection } from '@duckdb/node-api';
import path from 'node:path';
import { logger } from '@shared/infrastructure/logger';
import { quoteIdentifier, sqlString } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import type { PerAtomParquetSource } from '@modules/plugin/services/properties/PluginAtomProperties';
import type { JsonObject } from '@shared/contracts/types/json';
import type { MeshParquetSource, SubListingBatchSource } from '@shared/contracts/types/workflow-exposure';
import { PARQUET_SOURCE_KEY } from '@shared/contracts/types/workflow-exposure';

/**
 * Reads a `payload`-document exposure without ever holding an unbounded value in JS.
 *
 * Plugins may report an exposure as one JSON blob in a single `payload` column. Small
 * ones are parsed directly, but nothing bounds the big ones: a per-atom document for a
 * multi-million-atom frame, or a defect mesh over the same frame, runs past V8's
 * maximum string length (~512 MB) and the read fails outright with "Cannot create a
 * string longer than 0x1fffffe8 characters" — the value cannot be held, let alone
 * parsed. Splitting the document is not enough either, because a single section (the
 * mesh under `export`, the vertex list under `sub_listings`) is itself past the
 * ceiling.
 *
 * So every section is pulled out with DuckDB's JSON functions and only ever crosses
 * into JS in a bounded form:
 *
 *  - `main_listing` is a handful of counters, extracted whole, with a scalar-only
 *    fallback if a plugin ever puts something enormous there.
 *  - each `sub_listings` entry becomes a parquet of one JSON row per entry, streamed
 *    back to the caller in pages.
 *  - the per-atom array is flattened straight to a parquet that the columnar property
 *    path consumes.
 *  - the mesh and atomistic sections of `export` are flattened to parquet too, and the
 *    exporters read columns out of those files.
 *
 * The only sections still inlined are the ones the contract keeps aggregated (chart
 * series, exporter options), and those are size-checked before they are read.
 */

/** Documents below this stay on the simple path; V8's own ceiling is ~512 MB. */
const INLINE_PAYLOAD_LIMIT_BYTES = 64 * 1024 * 1024;

/**
 * Ceiling for any single value still read as a string. Far below V8's limit so the
 * decoded string, the parsed objects and whatever the caller builds from them all fit
 * at once.
 */
const INLINE_VALUE_LIMIT_BYTES = 32 * 1024 * 1024;

/** Rows per sub-listing page. Each row is one small JSON object. */
const SUB_LISTING_PAGE_ROWS = 20_000;

const PER_ATOM_JSON_PATH = '$."per-atom-properties"';

const MESH_EXPORTER = 'MeshExporter';
const ATOMISTIC_EXPORTER = 'AtomisticExporter';

/** Colour keys an atom may carry, matching the exporter's own precedence. */
const ATOM_COLOR_KEYS = ['color', 'structure_color', 'rgb', 'base_color'] as const;

interface LargePayloadDocument {
    listing: JsonObject | null;
    subListingNames: string[];
    subListingSources: SubListingBatchSource[];
    perAtomSource: PerAtomParquetSource | null;
    exportData: JsonObject | null;
}

export interface PayloadDocumentReadOptions {
    /**
     * Leaves `sub_listings` unread.
     *
     * A mesh describes its geometry twice: once under `export`, which the exporter turns
     * into the GLB the viewer loads, and once under `sub_listings` as one row per vertex
     * and one per facet. Reading the second copy is not cheap — it is the `unnestedArray`
     * shape, and it ends as a row per entry in Postgres, which measured ~109 s for the
     * 1.18M entries of a 2.5M-atom defect mesh. Nothing consumes those rows: the counts
     * the listing shows come from `main_listing`, and the geometry comes from the GLB.
     */
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

/** Byte size of the document, measured in the engine so nothing crosses into JS. */
export const measurePayloadBytes = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<number> => {
    // `strlen` counts bytes for VARCHAR; `octet_length` only accepts BLOB here.
    const value = await readSingleValue(
        connection,
        `SELECT MAX(strlen(payload)) AS bytes FROM read_parquet(${sqlString(filePath)})`,
        'bytes'
    );
    return Number(value ?? 0);
};

export const isPayloadTooLargeForJs = (bytes: number): boolean => bytes > INLINE_PAYLOAD_LIMIT_BYTES;

/**
 * The document, decompressed once per read instead of once per query.
 *
 * Taking a document apart needs a dozen statements — measure, list the keys, ask each
 * section's type, count the flattened rows — and each one used to carry its own
 * `read_parquet(...)`, so the whole payload was decompressed again every time. On the
 * ~100 MB document a 2.5M-atom defect mesh produces that showed up as the 4 s and 11 s
 * gaps between the exposure starting and its flatten actually running.
 *
 * The table is per-connection, and the caller owns the connection, so it is created and
 * dropped inside a single read.
 */
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

/** Byte size of one section, again measured inside the engine. */
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

/**
 * Extracts a section only when it is small enough to survive the trip.
 *
 * Returns `null` and says so in the log when it is not, which keeps one oversized
 * section from taking the whole exposure down: everything with a columnar path is
 * handled elsewhere, and what is left is aggregated by contract.
 */
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
    // `json_keys` yields a DuckDB LIST, which arrives as a JS array; casting it to
    // VARCHAR would produce `[a, b]`, which is not JSON.
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

/**
 * Unnests a JSON array of the document into rows, ordinal first.
 *
 * `ROW_NUMBER() OVER ()` numbers the elements in the order `UNNEST` produced them,
 * which is the order they appear in the document.
 */
const unnestedArray = (filePath: string, valuePath: string): string =>
    'WITH __items AS ('
    + `SELECT UNNEST(CAST(json_extract(payload, ${sqlString(valuePath)}) AS JSON[])) AS item `
    + `FROM ${PAYLOAD_TABLE}), `
    + '__ordered AS (SELECT ROW_NUMBER() OVER () - 1 AS ordinal, item FROM __items)';

/**
 * Same rows as `unnestedArray`, but the element type is declared up front so the engine
 * parses the array once instead of per field, and the ordinal comes from the list
 * subscript instead of a window function.
 *
 * Measured on a 376 557-vertex / 711 776-facet mesh, the shapes are not close: the
 * `unnestedArray` projection takes 25.3 s for the vertices and 51.0 s for the facets,
 * this one 0.8 s and 0.9 s, with identical row counts and column checksums. Keeping
 * the single `from_json` parse but restoring `ROW_NUMBER() OVER ()` costs 26.5 s again,
 * so the window function — not the JSON work — is what the ordinal has to avoid here.
 *
 * The trade is strictness: a field that does not fit `itemSchema` lands as NULL, where
 * the `TRY_CAST(json_extract_string(...))` pair also accepted a quoted number. Every
 * element of a mesh section is emitted numeric by the exporter, so the two agree on
 * real payloads.
 */
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

/**
 * Flattens the document's per-atom array or column map into a parquet file.
 *
 * Both shapes the contract allows are handled: an array of one object per atom, and
 * an object of one array per property. Multiple `unnest` calls in the same projection
 * are aligned positionally by DuckDB, which is what makes the column-map form work.
 */
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

/**
 * Splits `export.MeshExporter` into a vertex table and a facet table.
 *
 * Only the ids are kept for facets; resolving them against the vertex table is the
 * exporter's job and stays inside DuckDB there, so no per-vertex map is ever built in
 * JS. A vertex whose own `index` is missing gets a null id and therefore matches no
 * facet, exactly as a `undefined` map key did before.
 */
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

/**
 * Flattens `export.AtomisticExporter` — an object of one atom array per bucket — into
 * the same columnar shape the exposure parquet has, so the atomistic exporter's
 * existing parquet path reads it unchanged.
 *
 * `atom_index` is a single running counter over the buckets in document order, which
 * is what makes the exporter order buckets, and colour them by position, the way the
 * inline path did. All four colour columns are always emitted: an absent key is a null
 * list, which the exporter already skips on its way down the precedence chain.
 */
const flattenAtomisticExport = async (
    connection: DuckDBConnection,
    filePath: string,
    sectionPath: string,
    outputPath: string
): Promise<string | null> => {
    const buckets = await listJsonKeys(connection, filePath, sectionPath);
    if (buckets.length === 0) {
        return null;
    }

    const colorColumns = ATOM_COLOR_KEYS
        .map((key) => `TRY_CAST(json_extract(item, '$."${key}"') AS DOUBLE[]) AS ${quoteIdentifier(key)}`)
        .join(', ');

    await connection.run(
        'CREATE OR REPLACE TEMP TABLE __atomistic_flat ('
        + 'bucket VARCHAR, bucket_ordinal BIGINT, row_ordinal BIGINT, '
        + 'x DOUBLE, y DOUBLE, z DOUBLE, '
        + `${ATOM_COLOR_KEYS.map((key) => `${quoteIdentifier(key)} DOUBLE[]`).join(', ')})`
    );

    try {
        for (let bucketOrdinal = 0; bucketOrdinal < buckets.length; bucketOrdinal += 1) {
            const bucket = buckets[bucketOrdinal];
            const bucketPath = `${sectionPath}."${escapeJsonPathSegment(bucket)}"`;
            if (await jsonTypeAt(connection, filePath, bucketPath) !== 'ARRAY') {
                continue;
            }

            await connection.run(
                'INSERT INTO __atomistic_flat '
                + `${unnestedArray(filePath, bucketPath)} `
                + `SELECT ${sqlString(bucket)}, ${bucketOrdinal}, ordinal, `
                + `TRY_CAST(json_extract_string(item, '$.pos[0]') AS DOUBLE), `
                + `TRY_CAST(json_extract_string(item, '$.pos[1]') AS DOUBLE), `
                + `TRY_CAST(json_extract_string(item, '$.pos[2]') AS DOUBLE), `
                + `${colorColumns} `
                + 'FROM __ordered'
            );
        }

        await connection.run(copyToParquet(
            'SELECT bucket, '
            + 'ROW_NUMBER() OVER (ORDER BY bucket_ordinal, row_ordinal) - 1 AS atom_index, '
            + `x, y, z, ${ATOM_COLOR_KEYS.map((key) => quoteIdentifier(key)).join(', ')} `
            + 'FROM __atomistic_flat',
            outputPath
        ));
    } finally {
        await connection.run('DROP TABLE IF EXISTS __atomistic_flat');
    }

    const rowCount = await countParquetRows(connection, outputPath);
    logger.info(
        {
            path: filePath,
            bucketCount: buckets.length,
            atomCount: rowCount
        },
        'Flattened payload atomistic section to parquet'
    );

    return rowCount > 0 ? outputPath : null;
};

/**
 * Reads one exporter's section, columnar where the entity count is unbounded.
 *
 * An exporter with no columnar path keeps the inline read, guarded by size — chart
 * series and exporter options are aggregates, not per-entity data.
 */
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

/**
 * Rebuilds one `export`-like key of the document.
 *
 * The contract allows both an object of exporters and an array of such objects, and
 * `resolveExporterEntries` on the consuming side reads either.
 */
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

/**
 * Pages a flattened sub-listing back out of its parquet.
 *
 * The pages are cut on the ordinal rather than with `OFFSET` so each statement prunes
 * to the row groups it needs instead of rescanning the file, and the rows keep the
 * document's order — which is what makes the positional row ids stable across reruns.
 */
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

/**
 * Flattens one sub-listing to a parquet of one JSON row per entry.
 *
 * Each row stays a JSON string instead of being projected into columns: the entries
 * are small individually, their keys are the plugin's own, and this keeps the rows
 * byte-identical to what the inline path produced.
 */
const flattenSubListing = async (
    connection: DuckDBConnection,
    filePath: string,
    name: string,
    outputPath: string
): Promise<SubListingBatchSource | null> => {
    const entryPath = jsonPath('sub_listings', name);
    const kind = await jsonTypeAt(connection, filePath, entryPath);

    if (kind === 'OBJECT') {
        /* A single object counts as a one-row sub-listing, as on the inline path. */
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

/**
 * Falls back to reading `main_listing` one scalar at a time.
 *
 * Only reached if a plugin puts something enormous in there; the listing consumer
 * drops non-scalar entries anyway, so nothing it uses is lost.
 */
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
