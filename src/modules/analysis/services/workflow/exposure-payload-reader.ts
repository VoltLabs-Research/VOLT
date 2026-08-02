import type { WorkflowExposureInspectionResult } from '@shared/contracts/types/workflow-exposure';
import { DuckDBConnection } from '@duckdb/node-api';
import type { PerAtomProperties } from '@modules/plugin/services/properties/PluginAtomProperties';
import type { JsonObject } from '@shared/contracts/types/json';

export interface WorkflowExposurePayloadReadResult {
    listing: JsonObject | null;
    subListingNames: string[];
    subListings: Record<string, JsonObject[]>;
    perAtomProperties: PerAtomProperties | null;
    entityKind: 'atoms' | 'lines';
    exportData: JsonObject | null;
}

const PER_ATOM_KEY = 'per-atom-properties';
const FIXED_ATOM_COLUMNS = new Set(['atom_index', 'id', 'x', 'y', 'z', 'bucket', 'structure_id', 'structure_name']);
const NON_PROPERTY_COLUMNS = new Set(['atom_index', 'x', 'y', 'z', 'bucket']);

const isCosmeticColorColumn = (key: string): boolean =>
    key === 'color' || key.endsWith('_color');

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
        entityKind: 'lines',
        exportData: { export: { [exporter]: { [kind]: entities } } }
    };
};

const reconstructFromColumnarAtoms = (rows: JsonObject[]): WorkflowExposurePayloadReadResult => {
    const buckets = new Map<string, { structureId: number; atoms: JsonObject[] }>();
    const propertyRows: JsonObject[] = [];

    for (const rawRow of rows) {
        const row = normalizeParquetRow(rawRow);
        const bucket = (row.bucket as string | undefined) ?? 'All';
        const structureId = (row.structure_id as number | undefined) ?? 0;
        const atom: JsonObject = {
            id: row.id,
            pos: [row.x ?? 0, row.y ?? 0, row.z ?? 0],
            structure_id: structureId,
            structure_name: (row.structure_name as string | undefined) ?? bucket
        };
        const propertyRow: JsonObject = {};
        for (const [key, value] of Object.entries(row)) {
            if (!FIXED_ATOM_COLUMNS.has(key)) {
                atom[key] = value;
            }
            if (!NON_PROPERTY_COLUMNS.has(key) && !isCosmeticColorColumn(key)) {
                propertyRow[key] = value;
            }
        }
        const entry = buckets.get(bucket) ?? {
            structureId,
            atoms: []
        };
        entry.atoms.push(atom);
        buckets.set(bucket, entry);
        propertyRows.push(propertyRow);
    }

    const atomisticExporter: JsonObject = {};
    const structures: JsonObject[] = [];
    for (const [name, { structureId, atoms }] of buckets.entries()) {
        atomisticExporter[name] = atoms;
        structures.push({
            structure_id: structureId,
            structure_name: name,
            atom_count: atoms.length
        });
    }

    return {
        listing: {
            main_listing: {
                total_atoms: rows.length,
                structure_count: buckets.size
            }
        },
        subListingNames: structures.length > 0 ? ['structures'] : [],
        subListings: structures.length > 0 ? { structures } : {},
        perAtomProperties: propertyRows as PerAtomProperties,
        entityKind: 'atoms',
        exportData: { export: { AtomisticExporter: atomisticExporter } }
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

        const reader = await connection.runAndReadAll(
            `SELECT * FROM read_parquet(${sqlString(filePath)}) ORDER BY atom_index`
        );
        const rows = reader.getRowObjects() as JsonObject[];
        return reconstructFromColumnarAtoms(rows);
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
