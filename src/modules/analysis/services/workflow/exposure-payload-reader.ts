import type { WorkflowExposureInspectionResult } from '@shared/contracts/types/workflow-exposure';
import { DuckDBConnection } from '@duckdb/node-api';
import type { PerAtomParquetSource, PerAtomProperties } from '@modules/plugin/services/properties/PluginAtomProperties';
import type { JsonObject } from '@shared/contracts/types/json';
import path from 'node:path';
import { quoteIdentifier } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import {
    isPayloadTooLargeForJs,
    measurePayloadBytes,
    readLargePayloadDocument
} from '@modules/analysis/services/workflow/payload-document-reader';
import { ATOMISTIC_PARQUET_SOURCE_KEY } from '@modules/plugin/services/exports/export-node-processor-types';

export interface WorkflowExposurePayloadReadResult {
    listing: JsonObject | null;
    subListingNames: string[];
    subListings: Record<string, JsonObject[]>;
    perAtomProperties: PerAtomProperties | null;
    /** Set instead of `perAtomProperties` when the atoms stay in the plugin's parquet. */
    perAtomSource: PerAtomParquetSource | null;
    entityKind: 'atoms' | 'lines';
    exportData: JsonObject | null;
}

const PER_ATOM_KEY = 'per-atom-properties';
const DEFAULT_BUCKET_NAME = 'All';

export const createWorkflowExposureOutputFilePath = (
    outputDir: string,
    resultsFileName: string
): string => {
    return `${outputDir}_${resultsFileName}`;
};

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const normalizeValue = (value: unknown): unknown => {
    if (typeof value === 'bigint') return Number(value);
    if (Array.isArray(value)) return value.map(normalizeValue);
    if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) {
        return (value as { items: unknown[] }).items.map(normalizeValue);
    }
    return value;
};

export const normalizeParquetRow = (row: JsonObject): JsonObject => {
    const out: JsonObject = {};
    for (const [key, value] of Object.entries(row)) {
        out[key] = normalizeValue(value) as JsonObject[string];
    }
    return out;
};

const emptyResult = (): WorkflowExposurePayloadReadResult => ({
    listing: null,
    subListingNames: [],
    subListings: {},
    perAtomProperties: null,
    perAtomSource: null,
    entityKind: 'atoms',
    exportData: null
});

const extractFromDocument = (document: JsonObject): WorkflowExposurePayloadReadResult => {
    const mainListing = document.main_listing as JsonObject | undefined;

    const exportData: JsonObject = {};
    for (const [key, value] of Object.entries(document)) {
        if (key === 'export' || key.startsWith('export.')) {
            exportData[key] = value;
        }
    }

    const subListingNames = new Set<string>();
    const subListingRows = new Map<string, JsonObject[]>();
    const subListings = document.sub_listings as Record<string, JsonObject | JsonObject[]> | undefined;
    if (subListings) {
        for (const [name, value] of Object.entries(subListings)) {
            if (Array.isArray(value)) {
                if (value.length > 0) {
                    subListingNames.add(name);
                    subListingRows.set(name, value);
                }
            } else if (Object.keys(value).length > 0) {
                subListingNames.add(name);
                subListingRows.set(name, [value]);
            }
        }
    }

    return {
        listing: mainListing ? { main_listing: mainListing } : null,
        subListingNames: Array.from(subListingNames),
        subListings: Object.fromEntries(subListingRows),
        perAtomProperties: (document[PER_ATOM_KEY] as PerAtomProperties | null | undefined) ?? null,
        perAtomSource: null,
        entityKind: 'atoms',
        exportData: Object.keys(exportData).length > 0 ? exportData : null
    };
};

/**
 * Bond and line tables share a shape: a `points` column plus per-entity properties.
 * Only the listing counters and the exporter key differ.
 */
const reconstructFromPointsTable = (
    rows: JsonObject[],
    kind: 'bonds' | 'lines',
    exporter: 'BondExporter' | 'LineExporter'
): WorkflowExposurePayloadReadResult => {
    const entities: JsonObject[] = [];
    const propertyRows: JsonObject[] = [];
    let totalPoints = 0;

    for (const row of rows) {
        const { points, ...properties } = row;
        totalPoints += Array.isArray(points) ? points.length : 0;
        entities.push({
            ...properties,
            points
        });
        propertyRows.push(properties);
    }

    return {
        listing: {
            main_listing: kind === 'lines'
                ? {
                    lines: rows.length,
                    total_points: totalPoints
                }
                : { bonds: rows.length }
        },
        subListingNames: propertyRows.length > 0 ? [kind] : [],
        subListings: propertyRows.length > 0 ? { [kind]: propertyRows } : {},
        perAtomProperties: propertyRows as PerAtomProperties,
        perAtomSource: null,
        entityKind: 'lines',
        exportData: { export: { [exporter]: { [kind]: entities } } }
    };
};

/**
 * Summarises a plain atom table without materialising a single row.
 *
 * This replaced a loop over every atom that built five JS objects per atom — a row
 * copy, an atom, a position array, a property row and a cached flattened row — only
 * for both consumers to immediately reduce them back to columns. On a 4.45M-atom
 * frame that cost ~22 GB of heap and killed the daemon mid-analysis. The listing
 * counters are aggregates, the structure sub-listing is one row per bucket, and the
 * per-atom payload is handed on as a reference to the parquet the plugin wrote.
 *
 * Buckets keep the order in which they first appear by `atom_index`, because the
 * exporter derives a bucket's fallback colour from that position.
 */
const summarizeAtomTable = async (
    connection: DuckDBConnection,
    filePath: string,
    columnNames: string[]
): Promise<WorkflowExposurePayloadReadResult> => {
    const hasBucket = columnNames.includes('bucket');
    const hasStructureId = columnNames.includes('structure_id');
    const hasStructureName = columnNames.includes('structure_name');
    const bucketExpression = hasBucket ? quoteIdentifier('bucket') : sqlString(DEFAULT_BUCKET_NAME);
    const orderExpression = columnNames.includes('atom_index') ? quoteIdentifier('atom_index') : 'NULL';

    const totalsReader = await connection.runAndReadAll(
        `SELECT COUNT(*) AS total_atoms FROM read_parquet(${sqlString(filePath)})`
    );
    const totalAtoms = Number(totalsReader.getRowObjectsJS()[0]?.total_atoms ?? 0);

    const bucketsReader = await connection.runAndReadAll(
        'SELECT '
        + `${bucketExpression} AS bucket, `
        + `${hasStructureId ? `ANY_VALUE(${quoteIdentifier('structure_id')})` : '0'} AS structure_id, `
        + `${hasStructureName ? `ANY_VALUE(${quoteIdentifier('structure_name')})` : bucketExpression} AS structure_name, `
        + 'COUNT(*) AS atom_count, '
        + `MIN(${orderExpression}) AS first_index `
        + `FROM read_parquet(${sqlString(filePath)}) `
        + `GROUP BY ${bucketExpression} `
        + 'ORDER BY first_index NULLS LAST, bucket'
    );

    const structures: JsonObject[] = bucketsReader.getRowObjectsJS().map((row) => ({
        structure_id: Number(row.structure_id ?? 0),
        structure_name: String(row.structure_name ?? row.bucket ?? DEFAULT_BUCKET_NAME),
        atom_count: Number(row.atom_count ?? 0)
    }));

    return {
        listing: {
            main_listing: {
                total_atoms: totalAtoms,
                structure_count: structures.length
            }
        },
        subListingNames: structures.length > 0 ? ['structures'] : [],
        subListings: structures.length > 0 ? { structures } : {},
        perAtomProperties: null,
        perAtomSource: {
            filePath,
            rowCount: totalAtoms
        },
        entityKind: 'atoms',
        exportData: totalAtoms > 0
            ? { export: { AtomisticExporter: { [ATOMISTIC_PARQUET_SOURCE_KEY]: filePath } } }
            : null
    };
};

export const readWorkflowExposurePayload = async (
    filePath: string
): Promise<WorkflowExposurePayloadReadResult> => {
    const connection = await DuckDBConnection.create();
    try {
        const schemaReader = await connection.runAndReadAll(
            `DESCRIBE SELECT * FROM read_parquet(${sqlString(filePath)})`
        );
        const columnNames = schemaReader.getRows().map((row) => String(row[0]));

        if (columnNames.length === 1 && columnNames[0] === 'payload') {
            const payloadBytes = await measurePayloadBytes(connection, filePath);
            /*
             * A document past V8's string ceiling cannot be read at all, so it is taken
             * apart inside DuckDB instead. Smaller ones keep the direct parse, which is
             * cheaper than a dozen extraction statements.
             */
            if (isPayloadTooLargeForJs(payloadBytes)) {
                const document = await readLargePayloadDocument(
                    connection,
                    filePath,
                    path.dirname(filePath)
                );
                return {
                    listing: document.listing,
                    subListingNames: document.subListingNames,
                    subListings: document.subListings,
                    perAtomProperties: null,
                    perAtomSource: document.perAtomSource,
                    entityKind: 'atoms',
                    exportData: document.exportData
                };
            }

            const reader = await connection.runAndReadAll(
                `SELECT payload FROM read_parquet(${sqlString(filePath)}) LIMIT 1`
            );
            const payloadRows = reader.getRowObjects();
            const payload = payloadRows[0]?.payload as string | undefined;
            if (payload === undefined) {
                return emptyResult();
            }
            return extractFromDocument(JSON.parse(payload) as JsonObject);
        }

        if (
            columnNames.includes('points')
            && columnNames.includes('id')
            && columnNames.includes('atom_a')
            && columnNames.includes('atom_b')
        ) {
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(filePath)}) ORDER BY id`
            );
            const rows = (reader.getRowObjects() as JsonObject[]).map(normalizeParquetRow);
            return reconstructFromPointsTable(rows, 'bonds', 'BondExporter');
        }

        if (columnNames.includes('points') && columnNames.includes('id')) {
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(filePath)}) ORDER BY id`
            );
            const rows = (reader.getRowObjects() as JsonObject[]).map(normalizeParquetRow);
            return reconstructFromPointsTable(rows, 'lines', 'LineExporter');
        }

        return await summarizeAtomTable(connection, filePath, columnNames);
    } finally {
        connection.closeSync();
    }
};

export const inspectWorkflowExposureOutput = async (
    outputDir: string,
    resultsFileName: string
): Promise<WorkflowExposureInspectionResult> => {
    const outputFilePath = createWorkflowExposureOutputFilePath(outputDir, resultsFileName);

    if (!resultsFileName.toLowerCase().endsWith('.parquet')) {
        return {
            outputFilePath,
            listingRowCount: 0,
            subListingNames: [],
            exportPayload: null
        };
    }

    const { listing, subListingNames, exportData } = await readWorkflowExposurePayload(outputFilePath);
    const mainListing = listing?.main_listing as JsonObject | undefined;

    return {
        outputFilePath,
        listingRowCount: mainListing ? Object.keys(mainListing).length : 0,
        subListingNames,
        exportPayload: exportData
    };
};
