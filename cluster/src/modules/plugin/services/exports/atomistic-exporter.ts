import { DuckDBConnection } from '@duckdb/node-api';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { quoteIdentifier, sqlString } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import { stageExportBufferUpload, YIELD_INTERVAL, yieldToEventLoop } from '@modules/plugin/services/exports/export-node-processor-shared';
import { exportOctreeMetadata } from '@modules/plugin/services/exports/octree-exporter';
import { resolveCategoryColors } from '@modules/plugin/services/exports/category-colors';
import type { CategoryColor } from '@modules/plugin/services/exports/category-colors';
import {
    type AtomisticAtom,
    type AtomisticExportData,
    type AtomisticExportOptions,
    type ExportExecutionInput,
    type OctreeExportOptions,
    readAtomisticParquetSource
} from '@modules/plugin/services/exports/export-node-processor-types';
import spatialAssembler from '@voltstack/spatial-assembler';

/**
 * Colour per category name, from whatever the plugin declared, falling back to a
 * generated colour. The daemon does not know what any category means -- see
 * category-colors.ts.
 */
const buildCategoryPalette = (
    categories: Iterable<string>,
    declaredColors: Record<string, CategoryColor> | undefined
): Map<string, [number, number, number]> => {
    const resolved = resolveCategoryColors(categories, declaredColors);
    const palette = new Map<string, [number, number, number]>();
    for (const [category, [red, green, blue]] of resolved) {
        palette.set(category, [red, green, blue]);
    }
    return palette;
};

const NEUTRAL_COLOR: [number, number, number] = [0.5, 0.5, 0.5];

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
    exportData: Record<string, AtomisticAtom[]>,
    declaredColors: Record<string, CategoryColor> | undefined
): Promise<PointCloudData | null> => {
    const entries = Object.entries(exportData);
    const totalAtoms = entries.reduce((sum, [, atoms]) => sum + atoms.length, 0);
    if (totalAtoms === 0) {
        return null;
    }

    const palette = buildCategoryPalette(entries.map(([typeName]) => typeName), declaredColors);

    const positions = new Float32Array(totalAtoms * 3);
    const colors = new Float32Array(totalAtoms * 3);
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let offset = 0;
    let sinceLastYield = 0;

    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const [typeName, atoms] = entries[entryIndex];
        const fallbackColor = palette.get(typeName) ?? NEUTRAL_COLOR;

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

const buildPointCloudFromParquet = async (
    filePath: string,
    declaredColors: Record<string, CategoryColor> | undefined
): Promise<PointCloudData | null> => {
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

        const fallbackColors = buildCategoryPalette(buckets.map((bucket) => bucket.name), declaredColors);
        const firstBucketColor = fallbackColors.get(buckets[0].name) ?? NEUTRAL_COLOR;

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
    octreeOptions?: OctreeExportOptions,
    options?: AtomisticExportOptions
): Promise<boolean> => {
    const parquetSource = readAtomisticParquetSource(exportData);
    const pointCloud = parquetSource
        ? await buildPointCloudFromParquet(parquetSource, options?.propertyColors)
        : await buildPointCloudDataDirect(exportData as Record<string, AtomisticAtom[]>, options?.propertyColors);
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
