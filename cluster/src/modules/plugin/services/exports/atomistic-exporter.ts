import { DuckDBConnection } from '@duckdb/node-api';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { quoteIdentifier, sqlString } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import { stageExportBufferUpload, YIELD_INTERVAL, yieldToEventLoop } from '@modules/plugin/services/exports/export-node-processor-shared';
import { exportOctreeMetadata } from '@modules/plugin/services/exports/octree-exporter';
import { hueToRgb } from '@modules/plugin/services/exports/category-colors';
import {
    type AtomisticAtom,
    type AtomisticExportData,
    type ExportExecutionInput,
    type OctreeExportOptions,
    readAtomisticParquetSource
} from '@modules/plugin/services/exports/export-node-processor-types';
import spatialAssembler from '@voltstack/spatial-assembler';

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    if (s === 0) {
        return [l, l, l];
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        hueToRgb(p, q, h + 1 / 3),
        hueToRgb(p, q, h),
        hueToRgb(p, q, h - 1 / 3)
    ];
};

const EXTENDED_PALETTE: [number, number, number][] = [
    [0.91, 0.30, 0.24],
    [0.20, 0.60, 0.86],
    [0.18, 0.80, 0.44],
    [0.95, 0.77, 0.06],
    [0.61, 0.35, 0.71],
    [1.00, 0.50, 0.00],
    [0.00, 0.81, 0.82],
    [0.85, 0.20, 0.53],
    [0.55, 0.76, 0.22],
    [0.36, 0.25, 0.60],
    [1.00, 0.62, 0.47],
    [0.00, 0.50, 0.50],
    [0.80, 0.68, 0.00],
    [0.44, 0.68, 0.28],
    [0.69, 0.19, 0.38],
    [0.30, 0.75, 0.93],
    [0.90, 0.56, 0.67],
    [0.50, 0.50, 0.00],
    [0.00, 0.39, 0.74],
    [0.75, 0.94, 0.27],
    [0.58, 0.00, 0.83],
    [0.94, 0.42, 0.31],
    [0.27, 0.94, 0.94],
    [0.66, 0.47, 0.33]
];

const CLUSTER_NAME_RE = /^Cluster\s+(\d+)$/i;

const generateColor = (index: number): [number, number, number] => {
    if (index < EXTENDED_PALETTE.length) {
        return EXTENDED_PALETTE[index];
    }

    const goldenRatio = 0.618033988749895;
    const hue = ((index - EXTENDED_PALETTE.length) * goldenRatio) % 1.0;
    const saturation = 0.65 + (index % 3) * 0.1;
    const lightness = 0.45 + (index % 2) * 0.12;
    return hslToRgb(hue, saturation, lightness);
};

const colorForType = (typeName: string, typeIndex: number): [number, number, number] => {
    const predefined: Record<string, [number, number, number]> = {
        bcc: [102 / 255, 102 / 255, 1],
        fcc: [102 / 255, 1, 102 / 255],
        hcp: [1, 102 / 255, 102 / 255],
        dislocation: [1, 0.2, 0.2],
        ico: [1, 165 / 255, 0],
        sc: [160 / 255, 20 / 255, 254 / 255],
        cubic_diamond: [19 / 255, 160 / 255, 254 / 255],
        cubic_diamond_first_neigh: [0, 254 / 255, 245 / 255],
        cubic_diamond_second_neigh: [126 / 255, 254 / 255, 181 / 255],
        hex_diamond: [254 / 255, 137 / 255, 0],
        hex_diamond_first_neigh: [254 / 255, 220 / 255, 0],
        hex_diamond_second_neigh: [204 / 255, 229 / 255, 81 / 255],
        graphene: [50 / 255, 205 / 255, 50 / 255],
        unknown: [128 / 255, 128 / 255, 128 / 255],
        other: [242 / 255, 242 / 255, 242 / 255]
    };

    const normalized = typeName.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (predefined[normalized]) {
        return predefined[normalized];
    }

    const clusterMatch = CLUSTER_NAME_RE.exec(typeName);
    if (clusterMatch) {
        return generateColor(Number.parseInt(clusterMatch[1], 10));
    }

    return generateColor(typeIndex);
};

const normalizeExplicitColor = (value: AtomisticAtom['color']): [number, number, number] | null => {
    if (!value) {
        return null;
    }

    const scale = value[0] > 1 || value[1] > 1 || value[2] > 1 ? 255 : 1;
    return [
        Math.min(1, Math.max(0, value[0] / scale)),
        Math.min(1, Math.max(0, value[1] / scale)),
        Math.min(1, Math.max(0, value[2] / scale))
    ];
};

const colorForAtom = (
    atom: AtomisticAtom,
    fallback: [number, number, number]
): [number, number, number] => {
    return normalizeExplicitColor(atom.color)
        ?? normalizeExplicitColor(atom.structure_color)
        ?? normalizeExplicitColor(atom.rgb)
        ?? normalizeExplicitColor(atom.base_color)
        ?? fallback;
};

interface PointCloudData {
    positions: Float32Array;
    colors: Float32Array;
    min: [number, number, number];
    max: [number, number, number];
}

const buildPointCloudDataDirect = async (
    exportData: Record<string, AtomisticAtom[]>
): Promise<PointCloudData | null> => {
    const entries = Object.entries(exportData);
    const totalAtoms = entries.reduce((sum, [, atoms]) => sum + atoms.length, 0);
    if (totalAtoms === 0) {
        return null;
    }

    const positions = new Float32Array(totalAtoms * 3);
    const colors = new Float32Array(totalAtoms * 3);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let offset = 0;
    let sinceLastYield = 0;

    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const [typeName, atoms] = entries[entryIndex];
        const fallbackColor = colorForType(typeName, entryIndex);

        for (const atom of atoms) {
            const [x, y, z] = atom.pos;
            const base = offset * 3;
            const color = colorForAtom(atom, fallbackColor);
            positions[base] = x;
            positions[base + 1] = y;
            positions[base + 2] = z;
            colors[base] = color[0];
            colors[base + 1] = color[1];
            colors[base + 2] = color[2];
            min[0] = Math.min(min[0], x);
            min[1] = Math.min(min[1], y);
            min[2] = Math.min(min[2], z);
            max[0] = Math.max(max[0], x);
            max[1] = Math.max(max[1], y);
            max[2] = Math.max(max[2], z);
            offset += 1;
            sinceLastYield += 1;
            if (sinceLastYield >= YIELD_INTERVAL) {
                sinceLastYield = 0;
                await yieldToEventLoop();
            }
        }
    }

    return {
        positions,
        colors,
        min,
        max
    };
};

/** Colour columns an atom may carry, in the precedence `colorForAtom` applies. */
const COLOR_COLUMN_PRECEDENCE = ['color', 'structure_color', 'rgb', 'base_color'] as const;

interface ColorColumnSource {
    componentExpressions: [string, string, string];
}

const resolveColorColumnSources = (
    columnTypes: Map<string, string>
): ColorColumnSource[] => {
    const sources: ColorColumnSource[] = [];

    for (const name of COLOR_COLUMN_PRECEDENCE) {
        const type = columnTypes.get(name);
        if (!type) {
            continue;
        }

        const quoted = quoteIdentifier(name);
        // Lists hold the components; DuckDB indexes them from 1.
        sources.push({
            componentExpressions: type.endsWith('[]') || type.startsWith('LIST')
                ? [`${quoted}[1]`, `${quoted}[2]`, `${quoted}[3]`]
                : [`${quoted}_r`, `${quoted}_g`, `${quoted}_b`]
        });
    }

    return sources;
};

const normalizeColorComponents = (
    r: number | null,
    g: number | null,
    b: number | null
): [number, number, number] | null => {
    if (r === null || g === null || b === null) {
        return null;
    }

    const scale = r > 1 || g > 1 || b > 1 ? 255 : 1;
    return [
        Math.min(1, Math.max(0, r / scale)),
        Math.min(1, Math.max(0, g / scale)),
        Math.min(1, Math.max(0, b / scale))
    ];
};

const toNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

/**
 * Builds the point cloud straight from the exposure parquet.
 *
 * Reads one bucket at a time as columns, so peak memory is three position arrays
 * rather than an object per atom. Bucket order and the per-atom colour precedence
 * match the row-based path, keeping the generated GLB and octree identical.
 */
const buildPointCloudFromParquet = async (filePath: string): Promise<PointCloudData | null> => {
    const connection = await DuckDBConnection.create();

    try {
        const schemaReader = await connection.runAndReadAll(
            `DESCRIBE SELECT * FROM read_parquet(${sqlString(filePath)})`
        );
        const columnTypes = new Map<string, string>(
            schemaReader.getRowObjectsJS().map((row) => [
                String(row.column_name ?? ''),
                String(row.column_type ?? '').toUpperCase()
            ])
        );

        const hasBucket = columnTypes.has('bucket');
        const bucketExpression = hasBucket ? quoteIdentifier('bucket') : sqlString('All');
        const orderExpression = columnTypes.has('atom_index') ? quoteIdentifier('atom_index') : 'NULL';

        const bucketsReader = await connection.runAndReadAll(
            `SELECT ${bucketExpression} AS bucket, COUNT(*) AS atom_count, MIN(${orderExpression}) AS first_index `
            + `FROM read_parquet(${sqlString(filePath)}) `
            + `GROUP BY ${bucketExpression} ORDER BY first_index NULLS LAST, bucket`
        );
        const buckets = bucketsReader.getRowObjectsJS().map((row) => ({
            name: String(row.bucket ?? 'All'),
            atomCount: Number(row.atom_count ?? 0)
        }));

        const totalAtoms = buckets.reduce((sum, bucket) => sum + bucket.atomCount, 0);
        if (totalAtoms === 0) {
            return null;
        }

        const colorSources = resolveColorColumnSources(columnTypes);
        const colorProjection = colorSources
            .flatMap(({ componentExpressions }, sourceIndex) => componentExpressions
                .map((expression, component) =>
                    `TRY_CAST(${expression} AS DOUBLE) AS c${sourceIndex}_${component}`))
            .join(', ');

        const positions = new Float32Array(totalAtoms * 3);
        const colors = new Float32Array(totalAtoms * 3);
        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        let offset = 0;

        /*
         * One scan, not one per bucket.
         *
         * This used to issue a statement per bucket, each re-reading and re-sorting the
         * whole parquet to pull out the rows of that one bucket. Buckets are clusters, so
         * their count tracks the defect structure rather than the atom count: a coherent
         * regions document from a 2.5M-atom frame reached 164224 of them, and the export
         * stopped finishing at all. `atom_index` is a running counter assigned in bucket
         * order, so ordering the whole file by it once yields the identical sequence the
         * per-bucket loop produced.
         *
         * The fallback colour still comes from the bucket's position, resolved from the
         * bucket summary already read above. Rows arrive grouped, so the lookup only
         * happens when the bucket changes.
         */
        const fallbackColors = new Map(
            buckets.map((bucket, bucketIndex) => [bucket.name, colorForType(bucket.name, bucketIndex)])
        );
        const firstBucketColor = fallbackColors.get(buckets[0].name) ?? colorForType(buckets[0].name, 0);

        const result = await connection.stream(
            'SELECT '
            + `${bucketExpression} AS bucket, `
            + `TRY_CAST(${quoteIdentifier('x')} AS DOUBLE) AS x, `
            + `TRY_CAST(${quoteIdentifier('y')} AS DOUBLE) AS y, `
            + `TRY_CAST(${quoteIdentifier('z')} AS DOUBLE) AS z`
            + (colorProjection ? `, ${colorProjection}` : '')
            + ` FROM read_parquet(${sqlString(filePath)}) `
            + `ORDER BY ${orderExpression}`
        );

        const colorColumnCount = colorSources.length * 3;
        let currentBucketName: string | null = null;
        let fallbackColor = firstBucketColor;

        for (let chunk = await result.fetchChunk(); chunk; chunk = await result.fetchChunk()) {
            const rows = chunk.rowCount;
            if (rows === 0) break;

            const bucketVector = chunk.getColumnVector(0);
            const xVector = chunk.getColumnVector(1);
            const yVector = chunk.getColumnVector(2);
            const zVector = chunk.getColumnVector(3);
            const colorVectors = Array.from(
                { length: colorColumnCount },
                (_unused, index) => chunk.getColumnVector(4 + index)
            );

            for (let row = 0; row < rows; row += 1) {
                if (offset >= totalAtoms) break;

                const bucketName = String(bucketVector.getItem(row) ?? '');
                if (bucketName !== currentBucketName) {
                    currentBucketName = bucketName;
                    fallbackColor = fallbackColors.get(bucketName) ?? firstBucketColor;
                }

                const x = toNullableNumber(xVector.getItem(row)) ?? 0;
                const y = toNullableNumber(yVector.getItem(row)) ?? 0;
                const z = toNullableNumber(zVector.getItem(row)) ?? 0;

                let color: [number, number, number] | null = null;
                for (let sourceIndex = 0; sourceIndex < colorSources.length && !color; sourceIndex += 1) {
                    const base = sourceIndex * 3;
                    color = normalizeColorComponents(
                        toNullableNumber(colorVectors[base]?.getItem(row)),
                        toNullableNumber(colorVectors[base + 1]?.getItem(row)),
                        toNullableNumber(colorVectors[base + 2]?.getItem(row))
                    );
                }
                const resolved = color ?? fallbackColor;

                const base = offset * 3;
                positions[base] = x;
                positions[base + 1] = y;
                positions[base + 2] = z;
                colors[base] = resolved[0];
                colors[base + 1] = resolved[1];
                colors[base + 2] = resolved[2];
                min[0] = Math.min(min[0], x);
                min[1] = Math.min(min[1], y);
                min[2] = Math.min(min[2], z);
                max[0] = Math.max(max[0], x);
                max[1] = Math.max(max[1], y);
                max[2] = Math.max(max[2], z);
                offset += 1;
            }

            await yieldToEventLoop();
        }

        return {
            positions,
            colors,
            min,
            max
        };
    } finally {
        connection.closeSync();
    }
};

export const exportAtomisticArtifact = async (
    input: ExportExecutionInput,
    exportData: AtomisticExportData,
    objectPath: string,
    ownerClusterId: string,
    octreeOptions?: OctreeExportOptions
): Promise<boolean> => {
    const parquetSource = readAtomisticParquetSource(exportData);
    const pointCloud = parquetSource
        ? await buildPointCloudFromParquet(parquetSource)
        : await buildPointCloudDataDirect(exportData as Record<string, AtomisticAtom[]>);
    if (!pointCloud) {
        return false;
    }

    const buffer = spatialAssembler.generatePointCloudGLB(
        pointCloud.positions,
        pointCloud.colors,
        pointCloud.min,
        pointCloud.max
    );

    await stageExportBufferUpload(input, {
        exporter: 'AtomisticExporter',
        bucket: ObjectBucketName.Models,
        buffer,
        contentType: 'model/gltf-binary',
        objectPath,
        ownerClusterId
    });

    if (octreeOptions) {
        await exportOctreeMetadata(
            input,
            pointCloud.positions,
            pointCloud.positions.length / 3,
            objectPath,
            ownerClusterId,
            octreeOptions
        );
    }

    return true;
};
