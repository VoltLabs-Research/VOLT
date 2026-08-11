import type { DuckDBConnection } from '@duckdb/node-api';
import path from 'node:path';
import { quoteIdentifier, sqlString } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import type { PerAtomParquetSource } from '@modules/plugin/services/properties/PluginAtomProperties';
import type { JsonObject } from '@shared/contracts/types/json';

/**
 * Reads a `payload`-document exposure without ever holding the document in JS.
 *
 * Plugins may report an exposure as one JSON blob in a single `payload` column. Small
 * ones are parsed directly, but a per-atom document for a multi-million-atom frame
 * runs past V8's maximum string length (~512 MB) and the read fails outright with
 * "Cannot create a string longer than 0x1fffffe8 characters" — the document cannot be
 * held, let alone parsed.
 *
 * Every piece is therefore pulled out with DuckDB's JSON functions: the listing and
 * sub-listings are small enough to cross into JS on their own, and the per-atom array
 * is flattened straight to a parquet file that the columnar property path consumes.
 */

/** Documents below this stay on the simple path; V8's own ceiling is ~512 MB. */
const INLINE_PAYLOAD_LIMIT_BYTES = 64 * 1024 * 1024;

const PER_ATOM_JSON_PATH = '$."per-atom-properties"';

interface LargePayloadDocument {
    listing: JsonObject | null;
    subListingNames: string[];
    subListings: Record<string, JsonObject[]>;
    perAtomSource: PerAtomParquetSource | null;
    exportData: JsonObject | null;
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

const payloadSource = (filePath: string): string =>
    `(SELECT payload FROM read_parquet(${sqlString(filePath)}) LIMIT 1)`;

const extractJson = async (
    connection: DuckDBConnection,
    filePath: string,
    jsonPath: string
): Promise<unknown> => {
    const raw = await readSingleValue(
        connection,
        `SELECT CAST(json_extract(payload, ${sqlString(jsonPath)}) AS VARCHAR) AS value FROM ${payloadSource(filePath)}`,
        'value'
    );
    if (typeof raw !== 'string' || raw.length === 0 || raw === 'null') {
        return null;
    }
    return JSON.parse(raw);
};

const listJsonKeys = async (
    connection: DuckDBConnection,
    filePath: string,
    jsonPath: string | null
): Promise<string[]> => {
    const target = jsonPath === null ? 'payload' : `json_extract(payload, ${sqlString(jsonPath)})`;
    // `json_keys` yields a DuckDB LIST, which arrives as a JS array; casting it to
    // VARCHAR would produce `[a, b]`, which is not JSON.
    const raw = await readSingleValue(
        connection,
        `SELECT json_keys(${target}) AS keys FROM ${payloadSource(filePath)}`,
        'keys'
    );
    return Array.isArray(raw) ? raw.map((key) => String(key)) : [];
};

const jsonTypeAt = async (
    connection: DuckDBConnection,
    filePath: string,
    jsonPath: string
): Promise<string | null> => {
    const raw = await readSingleValue(
        connection,
        `SELECT json_type(payload, ${sqlString(jsonPath)}) AS kind FROM ${payloadSource(filePath)}`,
        'kind'
    );
    return typeof raw === 'string' ? raw.toUpperCase() : null;
};

const escapeJsonPathSegment = (key: string): string => key.replace(/"/g, '\\"');

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
            + `FROM ${payloadSource(filePath)}) `
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
        projection = `SELECT ${columns} FROM ${payloadSource(filePath)}`;
    } else {
        return null;
    }

    await connection.run(
        `COPY (SELECT ROW_NUMBER() OVER () - 1 AS atom_index, * FROM (${projection})) `
        + `TO ${sqlString(outputPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`
    );

    const rowCount = Number(await readSingleValue(
        connection,
        `SELECT COUNT(*) AS total FROM read_parquet(${sqlString(outputPath)})`,
        'total'
    ) ?? 0);

    return rowCount > 0 ? {
        filePath: outputPath,
        rowCount
    } : null;
};

export const readLargePayloadDocument = async (
    connection: DuckDBConnection,
    filePath: string,
    workingDirectory: string
): Promise<LargePayloadDocument> => {
    const topLevelKeys = await listJsonKeys(connection, filePath, null);

    const listing = topLevelKeys.includes('main_listing')
        ? await extractJson(connection, filePath, '$.main_listing')
        : null;

    const exportData: JsonObject = {};
    for (const key of topLevelKeys) {
        if (key !== 'export' && !key.startsWith('export.')) {
            continue;
        }
        const value = await extractJson(connection, filePath, `$."${escapeJsonPathSegment(key)}"`);
        if (value !== null) {
            exportData[key] = value as JsonObject[string];
        }
    }

    const subListings: Record<string, JsonObject[]> = {};
    if (topLevelKeys.includes('sub_listings')) {
        for (const name of await listJsonKeys(connection, filePath, '$.sub_listings')) {
            const value = await extractJson(
                connection,
                filePath,
                `$.sub_listings."${escapeJsonPathSegment(name)}"`
            );
            if (value === null) {
                continue;
            }
            const rows = Array.isArray(value) ? value as JsonObject[] : [value as JsonObject];
            if (rows.length > 0) {
                subListings[name] = rows;
            }
        }
    }

    const perAtomSource = topLevelKeys.includes('per-atom-properties')
        ? await flattenPerAtomProperties(
            connection,
            filePath,
            path.join(workingDirectory, `${path.basename(filePath)}.per-atom.parquet`)
        )
        : null;

    return {
        listing: listing ? { main_listing: listing as JsonObject } : null,
        subListingNames: Object.keys(subListings),
        subListings,
        perAtomSource,
        exportData: Object.keys(exportData).length > 0 ? exportData : null
    };
};
