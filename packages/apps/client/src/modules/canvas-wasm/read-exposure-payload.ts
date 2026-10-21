import { PARQUET_SOURCE_KEY } from './exporters/types';
import { readPayloadDocument } from './shim-table';
import type { ShimTable } from './shim-table';

// Port of the cluster's readWorkflowExposurePayload (exposure-payload-reader.ts): one exposure output
// becomes its listing, its sub-listings and the data its exporter consumes.

type Row = Record<string, unknown>;

export interface ExposurePayload {
    mainListing: Row | null;
    subListings: Record<string, Row[]>;
    // The document's `export` section, keyed by exporter name.
    exportSection: unknown;
    // Set when the output is a per-atom table.
    atomTable: ShimTable | null;
}

const toRows = (table: ShimTable): Row[] => table.rows.map((values) => (
    Object.fromEntries(table.columns.map((column, index) => [column.name, values[index]]))
));

const hasColumns = (table: ShimTable, ...names: string[]): boolean =>
    names.every((name) => table.columns.some((column) => column.name === name));

const fromDocument = (document: Row, skipSubListings: boolean): ExposurePayload => {
    const subListings: Record<string, Row[]> = {};
    const declared = skipSubListings ? undefined : document.sub_listings as Record<string, unknown> | undefined;
    for (const [name, value] of Object.entries(declared ?? {})) {
        const rows = (Array.isArray(value) ? value : [value])
            .filter((entry): entry is Row => Boolean(entry) && typeof entry === 'object' && Object.keys(entry).length > 0);
        if (rows.length > 0) {
            subListings[name] = rows;
        }
    }
    const mainListing = document.main_listing;
    return {
        mainListing: mainListing && typeof mainListing === 'object' ? mainListing as Row : null,
        subListings,
        exportSection: document.export ?? null,
        atomTable: null
    };
};

const fromPointsTable = (table: ShimTable, kind: 'lines' | 'bonds', exporter: string): ExposurePayload => {
    const entities = toRows(table).sort((left, right) => Number(left.id) - Number(right.id));
    const properties = entities.map(({ points: _points, ...rest }) => rest);
    const totalPoints = entities.reduce((sum, entity) => sum + (Array.isArray(entity.points) ? entity.points.length : 0), 0);
    return {
        mainListing: kind === 'lines' ? { lines: entities.length, total_points: totalPoints } : { bonds: entities.length },
        subListings: properties.length > 0 ? { [kind]: properties } : {},
        exportSection: { [exporter]: { [kind]: entities } },
        atomTable: null
    };
};

const compareNames = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const fromAtomTable = (table: ShimTable, fileName: string): ExposurePayload => {
    const indexOf = (name: string) => table.columns.findIndex((column) => column.name === name);
    const [bucketColumn, indexColumn, idColumn, nameColumn] = ['bucket', 'atom_index', 'structure_id', 'structure_name'].map(indexOf);
    const buckets = new Map<string, { structureId: number; structureName: string; count: number; firstIndex: number }>();
    for (const row of table.rows) {
        const bucket = bucketColumn < 0 ? 'All' : String(row[bucketColumn] ?? '');
        const firstIndex = indexColumn < 0 ? Infinity : Number(row[indexColumn]);
        const entry = buckets.get(bucket);
        if (entry) {
            entry.count += 1;
            entry.firstIndex = Math.min(entry.firstIndex, firstIndex);
            continue;
        }
        buckets.set(bucket, {
            structureId: idColumn < 0 ? 0 : Number(row[idColumn] ?? 0),
            structureName: nameColumn < 0 ? bucket : String(row[nameColumn] ?? bucket),
            count: 1,
            firstIndex
        });
    }
    const structures = Array.from(buckets.entries())
        .sort(([leftName, left], [rightName, right]) => left.firstIndex - right.firstIndex || compareNames(leftName, rightName))
        .map(([, { structureId, structureName, count }]) => ({
            structure_id: structureId,
            structure_name: structureName,
            atom_count: count
        }));

    return {
        mainListing: { total_atoms: table.rows.length, structure_count: structures.length },
        subListings: structures.length > 0 ? { structures } : {},
        exportSection: table.rows.length > 0 ? { AtomisticExporter: { [PARQUET_SOURCE_KEY]: fileName } } : null,
        atomTable: table
    };
};

export const readExposurePayload = (table: ShimTable, fileName: string, skipSubListings: boolean): ExposurePayload => {
    const document = readPayloadDocument(table);
    if (document) {
        return fromDocument(document, skipSubListings);
    }
    if (hasColumns(table, 'points', 'id', 'atom_a', 'atom_b')) {
        return fromPointsTable(table, 'bonds', 'BondExporter');
    }
    if (hasColumns(table, 'points', 'id')) {
        return fromPointsTable(table, 'lines', 'LineExporter');
    }
    return fromAtomTable(table, fileName);
};

// resolveExporterEntries: `export` maps exporter names to their data (an array form holds one map per entry;
// the canvas shows one scene per exposure, so the first entry carrying this exporter is used).
export const readExporterData = (exportSection: unknown, exporter: string): Row | null => {
    const sections = Array.isArray(exportSection) ? exportSection : [exportSection];
    for (const section of sections) {
        const data = section && typeof section === 'object' ? (section as Row)[exporter] : undefined;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return data as Row;
        }
    }
    return null;
};
