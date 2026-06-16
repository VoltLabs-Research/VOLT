import { DuckDBConnection } from '@duckdb/node-api';
import type { PerAtomProperties } from '@/modules/plugin/application/properties/PluginAtomProperties';
import type { JsonObject } from '@/support/types/json';
import { isRecord } from '@/support/type-guards/is-record';

export interface WorkflowExposurePayloadReadResult {
    listing: JsonObject | null;
    subListingNames: string[];
    subListings: Record<string, JsonObject[]>;
    perAtomProperties: PerAtomProperties | null;
    // Which entity the property rows describe — drives the property-store key
    // so line-entity rows never merge into per-atom data by id collision.
    entityKind: 'atoms' | 'lines';
    exportData: JsonObject | null;
}

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: JsonObject | null;
}

const PER_ATOM_KEY = 'per-atom-properties';
// Columns kept out of the AtomisticExporter atom record (already first-class there).
const FIXED_ATOM_COLUMNS = new Set(['atom_index', 'id', 'x', 'y', 'z', 'bucket', 'structure_id', 'structure_name']);
// Geometry / grouping columns that are not per-atom coloring properties; excluded
// from the property-store rows (the store owns atom_index itself and the GLB path
// owns positions/buckets).
const NON_PROPERTY_COLUMNS = new Set(['atom_index', 'x', 'y', 'z', 'bucket']);

// Cosmetic per-atom RGB columns a plugin bakes for its own GLB rendering (e.g.
// coordination's `color` / `coordination_color`). They are NOT analysis
// properties — surfacing them as selectable coloring/filter options is the
// "redundant per-atom-properties" the UI should never show. Kept in the GLB
// export payload, dropped from the property-store rows / discovery catalog.
const isCosmeticColorColumn = (key: string): boolean =>
    key === 'color' || key.endsWith('_color');

export const createWorkflowExposureOutputFilePath = (
    outputDir: string,
    resultsFileName: string
): string => {
    return `${outputDir}_${resultsFileName}`;
};

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

// DuckDB returns UINTEGER/UBIGINT columns as JS BigInt, which is not
// JSON-serializable downstream (Mongo persistence, socket payloads). Coerce to
// Number — atom ids/counts stay well within Number.MAX_SAFE_INTEGER.
const normalizeValue = (value: unknown): unknown => {
    if (typeof value === 'bigint') return Number(value);
    if (Array.isArray(value)) return value.map(normalizeValue);
    // DuckDB returns LIST columns (e.g. an RGB `color`) as `{ items: [...] }`;
    // unwrap to a plain array so consumers see the original vector shape.
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
    const listing: JsonObject = {};
    if (isRecord(document.main_listing)) {
        listing.main_listing = document.main_listing as JsonObject[string];
    }

    const exportData: JsonObject = {};
    for (const [key, value] of Object.entries(document)) {
        if (key === 'export' || key.startsWith('export.')) {
            exportData[key] = value as JsonObject[string];
        }
    }

    const subListingNames = new Set<string>();
    const subListingRows = new Map<string, JsonObject[]>();
    const subListings = document.sub_listings;
    if (isRecord(subListings)) {
        for (const [name, value] of Object.entries(subListings)) {
            if (Array.isArray(value)) {
                const rows = value.filter(isRecord) as JsonObject[];
                if (rows.length > 0) {
                    subListingNames.add(name);
                    subListingRows.set(name, rows);
                }
            } else if (isRecord(value) && Object.keys(value).length > 0) {
                subListingNames.add(name);
                subListingRows.set(name, [value as JsonObject]);
            }
        }
    }

    return {
        listing: Object.keys(listing).length > 0 ? listing : null,
        subListingNames: Array.from(subListingNames),
        subListings: Object.fromEntries(subListingRows),
        perAtomProperties: (document[PER_ATOM_KEY] as PerAtomProperties | null | undefined) ?? null,
        entityKind: 'atoms',
        exportData: Object.keys(exportData).length > 0 ? exportData : null
    };
};

// Rebuilds the decoded exposure shape from a bond entity table. A bond carries
// its two rendered endpoints inline in `points` (the same self-contained shape
// as a line), so the GLB export never joins against the atom table; atom_a /
// atom_b / pbc_shift_* / distance ride along as per-bond property columns. The
// property rows feed the same store as lines (keyed by bond id), under the
// non-atom `'lines'` storage suffix so analysis-wide per-atom merges never mix
// bond rows in by id collision — bonds need that isolation exactly as lines do.
const reconstructFromBondTable = (rows: JsonObject[]): WorkflowExposurePayloadReadResult => {
    const bonds: JsonObject[] = [];
    const propertyRows: JsonObject[] = [];

    for (const row of rows) {
        const { points, ...properties } = row;
        const bondPoints = Array.isArray(points) ? points : [];
        bonds.push({ ...properties, points: bondPoints as JsonObject[string] });
        propertyRows.push(properties);
    }

    return {
        listing: { main_listing: { bonds: rows.length } },
        subListingNames: propertyRows.length > 0 ? ['bonds'] : [],
        subListings: propertyRows.length > 0 ? { bonds: propertyRows } : {},
        perAtomProperties: propertyRows as unknown as PerAtomProperties,
        entityKind: 'lines',
        exportData: { export: { BondExporter: { bonds } } }
    };
};

// Rebuilds the decoded exposure shape from a line entity table (fixed id +
// points columns; every other column is a per-entity property). Properties
// feed the same property store as per-atom data — keyed by entity id — so
// discovery, stats, unique values and id lookups work identically for lines.
const reconstructFromLineTable = (rows: JsonObject[]): WorkflowExposurePayloadReadResult => {
    const lines: JsonObject[] = [];
    const propertyRows: JsonObject[] = [];
    let totalPoints = 0;

    for (const row of rows) {
        const { points, ...properties } = row;
        const linePoints = Array.isArray(points) ? points : [];
        totalPoints += linePoints.length;
        lines.push({ ...properties, points: linePoints as JsonObject[string] });
        propertyRows.push(properties);
    }

    return {
        listing: { main_listing: { lines: rows.length, total_points: totalPoints } },
        subListingNames: propertyRows.length > 0 ? ['lines'] : [],
        subListings: propertyRows.length > 0 ? { lines: propertyRows } : {},
        perAtomProperties: propertyRows as unknown as PerAtomProperties,
        entityKind: 'lines',
        exportData: { export: { LineExporter: { lines } } }
    };
};

// Rebuilds the decoded exposure shape from a columnar per-atom Parquet table:
// the per-atom rows feed the property store, atoms group by bucket into the
// AtomisticExporter payload, and listings derive from those groups. Rows arrive
// raw from getRowObjects() and are normalized here in the single consuming pass
// (atom record + property row built together) so the whole table is never held
// as a separate normalized .map() copy.
const reconstructFromColumnarAtoms = (rows: JsonObject[]): WorkflowExposurePayloadReadResult => {
    const buckets = new Map<string, { structureId: number; atoms: JsonObject[] }>();
    // Per-atom coloring rows: drop geometry/grouping columns so the property
    // store (which owns timestep/atom_index/id) does not collide on rebuild, and
    // drop cosmetic RGB columns so they never appear as selectable properties.
    const propertyRows: JsonObject[] = [];

    for (const rawRow of rows) {
        const row = normalizeParquetRow(rawRow);
        const bucket = typeof row.bucket === 'string' ? row.bucket : 'All';
        const structureId = typeof row.structure_id === 'number' ? row.structure_id : 0;
        const atom: JsonObject = {
            id: row.id,
            pos: [row.x ?? 0, row.y ?? 0, row.z ?? 0],
            structure_id: structureId,
            structure_name: typeof row.structure_name === 'string' ? row.structure_name : bucket
        };
        const propertyRow: JsonObject = {};
        for (const [key, value] of Object.entries(row)) {
            if (!FIXED_ATOM_COLUMNS.has(key)) {
                atom[key] = value as JsonObject[string];
            }
            if (!NON_PROPERTY_COLUMNS.has(key) && !isCosmeticColorColumn(key)) {
                propertyRow[key] = value as JsonObject[string];
            }
        }
        const entry = buckets.get(bucket) ?? { structureId, atoms: [] };
        entry.atoms.push(atom);
        buckets.set(bucket, entry);
        propertyRows.push(propertyRow);
    }

    const atomisticExporter: JsonObject = {};
    const structures: JsonObject[] = [];
    for (const [name, { structureId, atoms }] of buckets.entries()) {
        atomisticExporter[name] = atoms as JsonObject[string];
        structures.push({ structure_id: structureId, structure_name: name, atom_count: atoms.length });
    }

    return {
        listing: { main_listing: { total_atoms: rows.length, structure_count: buckets.size } },
        subListingNames: structures.length > 0 ? ['structures'] : [],
        subListings: structures.length > 0 ? { structures } : {},
        perAtomProperties: propertyRows as unknown as PerAtomProperties,
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

        // Summary / export / mesh results carry the JSON document in a single `payload` column.
        if (columnNames.length === 1 && columnNames[0] === 'payload') {
            const reader = await connection.runAndReadAll(
                `SELECT payload FROM read_parquet(${sqlString(filePath)}) LIMIT 1`
            );
            const payloadRows = reader.getRowObjects();
            const payload = payloadRows.length > 0 ? payloadRows[0].payload : undefined;
            if (typeof payload !== 'string') {
                return emptyResult();
            }
            const document = JSON.parse(payload) as unknown;
            return isRecord(document) ? extractFromDocument(document as JsonObject) : emptyResult();
        }

        // Bond entity table: fixed id + points geometry + atom_a/atom_b
        // references. Checked before the line branch (it is also id + points).
        if (
            columnNames.includes('points')
            && columnNames.includes('id')
            && columnNames.includes('atom_a')
            && columnNames.includes('atom_b')
        ) {
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(filePath)}) ORDER BY id`
            );
            const rows = (reader.getRowObjects() as unknown as JsonObject[]).map(normalizeParquetRow);
            return reconstructFromBondTable(rows);
        }

        // Line entity table: fixed id + points geometry column.
        if (columnNames.includes('points') && columnNames.includes('id')) {
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet(${sqlString(filePath)}) ORDER BY id`
            );
            const rows = (reader.getRowObjects() as unknown as JsonObject[]).map(normalizeParquetRow);
            return reconstructFromLineTable(rows);
        }

        // Columnar per-atom table. Rows are passed raw; reconstructFromColumnarAtoms
        // normalizes each row inside its single consuming pass to avoid an extra
        // full-table .map() copy.
        const reader = await connection.runAndReadAll(
            `SELECT * FROM read_parquet(${sqlString(filePath)}) ORDER BY atom_index`
        );
        const rows = reader.getRowObjects() as unknown as JsonObject[];
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

    // Opaque shared-context exposures (plain-text `*.table` cluster-graph files)
    // are not Parquet — DuckDB read_parquet would throw on them. They carry no
    // listing or export payload, so report an empty inspection rather than fail.
    if (!resultsFileName.toLowerCase().endsWith('.parquet')) {
        return {
            outputFilePath,
            listingRowCount: 0,
            subListingNames: [],
            exportPayload: null
        };
    }

    const { listing, subListingNames, exportData } = await readWorkflowExposurePayload(outputFilePath);
    const mainListing = listing?.main_listing;

    return {
        outputFilePath,
        listingRowCount: isRecord(mainListing) ? Object.keys(mainListing).length : 0,
        subListingNames,
        exportPayload: exportData
    };
};
