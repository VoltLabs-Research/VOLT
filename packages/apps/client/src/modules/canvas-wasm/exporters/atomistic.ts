import { resolveCategoryColors } from './category-colors';
import { buildPointCloudGlb } from './glb';
import { PARQUET_SOURCE_KEY } from './types';
import type { ShimTable } from '../shim-table';
import type { AtomisticExportOptions, Vec3 } from './types';

// Port of the cluster's AtomisticExporter (atomistic-exporter.ts): positions come from the exposure's own
// table, colors from an explicit color column or else from the category palette of its `bucket`.

const NEUTRAL_COLOR: Vec3 = [0.5, 0.5, 0.5];
const COLOR_COLUMN_PRECEDENCE = ['color', 'structure_color', 'rgb', 'base_color'] as const;

interface PointCloud {
    positions: Float32Array;
    colors: Float32Array;
}

const toNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const normalizeColor = (red: number | null, green: number | null, blue: number | null): Vec3 | null => {
    if (red === null || green === null || blue === null) {
        return null;
    }
    const scale = red > 1 || green > 1 || blue > 1 ? 255 : 1;
    return [
        Math.min(1, Math.max(0, red / scale)),
        Math.min(1, Math.max(0, green / scale)),
        Math.min(1, Math.max(0, blue / scale))
    ];
};

const normalizeColorValue = (value: unknown): Vec3 | null => (
    Array.isArray(value)
        ? normalizeColor(toNullableNumber(value[0]), toNullableNumber(value[1]), toNullableNumber(value[2]))
        : null
);

const buildPalette = (categories: Iterable<string>, declared: AtomisticExportOptions['propertyColors']): Map<string, Vec3> => {
    const palette = new Map<string, Vec3>();
    for (const [category, [red, green, blue]] of resolveCategoryColors(categories, declared)) {
        palette.set(category, [red, green, blue]);
    }
    return palette;
};

// A color column is either a list (DOUBLE[]) or split into <name>_r/_g/_b columns.
const colorReaders = (table: ShimTable): Array<(row: unknown[]) => Vec3 | null> => {
    const indexOf = (name: string) => table.columns.findIndex((column) => column.name === name);
    return COLOR_COLUMN_PRECEDENCE.flatMap((name) => {
        const column = indexOf(name);
        if (column < 0) return [];
        const type = table.columns[column].type.toUpperCase();
        if (type.endsWith('[]') || type.startsWith('LIST')) {
            return [(row: unknown[]) => normalizeColorValue(row[column])];
        }
        const components = ['r', 'g', 'b'].map((channel) => indexOf(`${name}_${channel}`));
        return components.includes(-1)
            ? []
            : [(row: unknown[]) => normalizeColor(...components.map((index) => toNullableNumber(row[index])) as [number | null, number | null, number | null])];
    });
};

const pointCloudFromTable = (table: ShimTable, declared: AtomisticExportOptions['propertyColors']): PointCloud | null => {
    if (table.rows.length === 0) {
        return null;
    }

    const indexOf = (name: string) => table.columns.findIndex((column) => column.name === name);
    const [bucket, atomIndex, x, y, z] = ['bucket', 'atom_index', 'x', 'y', 'z'].map(indexOf);
    const bucketOf = (row: unknown[]) => (bucket < 0 ? 'All' : String(row[bucket] ?? ''));
    const rows = atomIndex < 0
        ? table.rows
        : [...table.rows].sort((left, right) => Number(left[atomIndex]) - Number(right[atomIndex]));

    const palette = buildPalette(rows.map(bucketOf), declared);
    const readers = colorReaders(table);
    const positions = new Float32Array(rows.length * 3);
    const colors = new Float32Array(rows.length * 3);

    rows.forEach((row, index) => {
        positions[index * 3] = x < 0 ? 0 : toNullableNumber(row[x]) ?? 0;
        positions[index * 3 + 1] = y < 0 ? 0 : toNullableNumber(row[y]) ?? 0;
        positions[index * 3 + 2] = z < 0 ? 0 : toNullableNumber(row[z]) ?? 0;
        let color: Vec3 | null = null;
        for (let reader = 0; reader < readers.length && !color; reader += 1) {
            color = readers[reader](row);
        }
        colors.set(color ?? palette.get(bucketOf(row)) ?? NEUTRAL_COLOR, index * 3);
    });

    return { positions, colors };
};

interface InlineAtom {
    pos: Vec3;
    color?: number[];
    structure_color?: number[];
    rgb?: number[];
    base_color?: number[];
}

// Inline payloads group atoms by category: { "FCC": [{ pos: [x, y, z] }, ...], ... }.
const pointCloudFromBuckets = (buckets: Record<string, InlineAtom[]>, declared: AtomisticExportOptions['propertyColors']): PointCloud | null => {
    const entries = Object.entries(buckets).filter(([, atoms]) => Array.isArray(atoms));
    const total = entries.reduce((sum, [, atoms]) => sum + atoms.length, 0);
    if (total === 0) {
        return null;
    }

    const palette = buildPalette(entries.map(([name]) => name), declared);
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    let offset = 0;
    for (const [name, atoms] of entries) {
        const fallback = palette.get(name) ?? NEUTRAL_COLOR;
        for (const atom of atoms) {
            positions.set(atom.pos, offset * 3);
            const color = normalizeColorValue(atom.color)
                ?? normalizeColorValue(atom.structure_color)
                ?? normalizeColorValue(atom.rgb)
                ?? normalizeColorValue(atom.base_color)
                ?? fallback;
            colors.set(color, offset * 3);
            offset += 1;
        }
    }
    return { positions, colors };
};

// exportData is either { __parquet_source__: <file> } (the atom table itself) or inline buckets.
export const exportAtomistic = (
    exportData: Record<string, unknown>,
    options: AtomisticExportOptions,
    readTable: (fileName: string) => ShimTable | null
): Blob | null => {
    const source = exportData[PARQUET_SOURCE_KEY];
    const table = typeof source === 'string' ? readTable(source) : null;
    const cloud = table
        ? pointCloudFromTable(table, options.propertyColors)
        : pointCloudFromBuckets(exportData as Record<string, InlineAtom[]>, options.propertyColors);
    return cloud ? buildPointCloudGlb(cloud.positions, cloud.colors) : null;
};
