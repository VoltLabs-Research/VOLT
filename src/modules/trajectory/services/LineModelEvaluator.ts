import { singleton } from '@shared/application/utilities/singleton';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { DuckDBConnection } from '@duckdb/node-api';
import spatialAssembler from '@voltstack/spatial-assembler';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ObjectBucketName } from '@shared/contracts';
import { DAEMON_PATHS } from '@core/config/paths';
import { createScopedClusterObjectStore, type ClusterObjectStore, getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { uploadBufferToObjectStore } from '@shared/infrastructure/storage/upload-buffer-to-object-store';
import { normalizeParquetRow } from '@modules/analysis/services/workflow/exposure-payload-reader';
import { resolveCategoryColors } from '@modules/plugin/services/exports/category-colors';
import {
    buildLineRangesSidecarKey,
    buildLineSceneSourceKey
} from '@modules/plugin/services/exports/line-scene-source';
import {
    buildLineGlb,
    encodeLineRangesSidecar,
    generateEmptyLineGLB,
    processLines,
    resolveEntityCategory,
    resolveLineOptions
} from '@modules/plugin/services/exports/line-exporter';
import { resolveGradientCode } from '@modules/trajectory/services/FilterEvaluator';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import type { JsonObject } from '@shared/contracts/types/json';

import type {
    LineEntity,
    LineExportOptions
} from '@modules/plugin/services/exports/export-node-processor-types';

export type LineColorMode = 'category' | 'uniform' | 'gradient';
export type LineStyleFilterOperator = 'gte' | 'lte' | 'eq' | 'neq';

export interface LineStyleFilter {
    property: string;
    operator: LineStyleFilterOperator;
    value: number | string;
}

export interface LineStyleInput {
    lineWidth?: number;
    tubularSegments?: number;
    colorMode?: LineColorMode;
    colorProperty?: string;
    categoryColors?: Record<string, [number, number, number, number]>;
    categoryVisibility?: Record<string, boolean>;
    uniformColor?: [number, number, number, number];
    gradient?: string;
    startValue?: number;
    endValue?: number;
    filters?: LineStyleFilter[];
}

export interface ExportLineModelInput {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    ownerClusterId: string;
    objectKey: string;
    baseOptions?: LineExportOptions;
    style?: LineStyleInput;
}

export interface ExportLineModelResult {
    objectKey: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
}

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const toLineEntity = (row: JsonObject): LineEntity => {
    const points = Array.isArray(row.points) ? row.points : [];
    return {
        ...row,
        id: Number(row.id),
        points
    } as LineEntity;
};

const numericPropertyValue = (entity: LineEntity, property: string): number => {
    const value = Number(entity[property]);
    return Number.isFinite(value) ? value : 0;
};

const passesFilter = (entity: LineEntity, filter: LineStyleFilter): boolean => {
    const raw = entity[filter.property];
    switch (filter.operator) {
        case 'gte':
            return Number(raw) >= Number(filter.value);
        case 'lte':
            return Number(raw) <= Number(filter.value);
        case 'eq':
            return typeof filter.value === 'number'
                ? Number(raw) === filter.value
                : String(raw ?? '') === filter.value;
        case 'neq':
            return typeof filter.value === 'number'
                ? Number(raw) !== filter.value
                : String(raw ?? '') !== filter.value;
        default:
            return true;
    }
};

export class LineModelEvaluator {
    constructor(private readonly objectStore: ClusterObjectStore) {}

    async exportLineModel(input: ExportLineModelInput): Promise<ExportLineModelResult> {
        const lines = await this.readSceneSource(input);
        const style = input.style ?? {};
        const baseOptions = input.baseOptions ?? {};

        const resolvedOptions = resolveLineOptions({
            ...baseOptions,
            lineWidth: style.lineWidth ?? baseOptions.lineWidth,
            tubularSegments: style.tubularSegments ?? baseOptions.tubularSegments
        });

        const colorMode: LineColorMode = style.colorMode ?? (resolvedOptions.colorBy ? 'category' : 'uniform');
        const colorProperty = style.colorProperty
            ?? (resolvedOptions.colorBy.length > 0 ? resolvedOptions.colorBy : undefined);

        const categoryCounts: Record<string, number> = {};
        if (colorProperty) {
            for (const line of lines) {
                const category = resolveEntityCategory(line, colorProperty);
                categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
            }
        }

        const getEntityColor = this.buildEntityColorResolver(lines, colorMode, colorProperty, resolvedOptions, style);
        const categoryVisibility = style.categoryVisibility;
        const filters = style.filters ?? [];

        let entitiesRendered = 0;
        const geometry = await processLines({ lines }, resolvedOptions, {
            includeEntity: (entity) => {
                if (categoryVisibility && colorProperty) {
                    const category = resolveEntityCategory(entity, colorProperty);
                    if (categoryVisibility[category] === false) {
                        return false;
                    }
                }
                if (!filters.every((filter) => passesFilter(entity, filter))) {
                    return false;
                }
                entitiesRendered += 1;
                return true;
            },
            getEntityColor
        });

        const buffer = geometry
            ? buildLineGlb(geometry, resolvedOptions.material)
            : generateEmptyLineGLB(resolvedOptions.material);

        await this.uploadGlb(buffer, input.objectKey, input.ownerClusterId);
        await this.uploadRangesSidecar(geometry?.entityRanges ?? [], input.objectKey, input.ownerClusterId);

        return {
            objectKey: input.objectKey,
            entitiesRendered,
            entitiesTotal: lines.length,
            categoryCounts
        };
    }

    private buildEntityColorResolver(
        lines: LineEntity[],
        colorMode: LineColorMode,
        colorProperty: string | undefined,
        options: Required<LineExportOptions>,
        style: LineStyleInput
    ): (entity: LineEntity) => [number, number, number, number] {
        if (colorMode === 'uniform' || !colorProperty) {
            const color = style.uniformColor ?? options.material.baseColor;
            return () => color;
        }

        if (colorMode === 'gradient') {
            const values = new Float32Array(lines.length);
            for (let index = 0; index < lines.length; index += 1) {
                values[index] = numericPropertyValue(lines[index], colorProperty);
            }

            let min = Infinity;
            let max = -Infinity;
            for (const value of values) {
                if (value < min) min = value;
                if (value > max) max = value;
            }
            if (!Number.isFinite(min)) min = 0;
            if (!Number.isFinite(max)) max = 0;

            const startValue = style.startValue ?? min;
            const endValue = style.endValue ?? max;
            const colors: Float32Array = spatialAssembler.applyPropertyColors(
                values,
                startValue,
                endValue,
                resolveGradientCode(style.gradient ?? 'Viridis')
            );

            const colorByEntity = new Map<LineEntity, [number, number, number, number]>();
            for (let index = 0; index < lines.length; index += 1) {
                colorByEntity.set(lines[index], [
                    colors[index * 3],
                    colors[index * 3 + 1],
                    colors[index * 3 + 2],
                    1
                ]);
            }

            return (entity) => colorByEntity.get(entity) ?? [0.9, 0.2, 0.2, 1];
        }

        const categories = lines.map((line) => resolveEntityCategory(line, colorProperty));
        const categoryColors = resolveCategoryColors(categories, {
            ...options.propertyColors,
            ...style.categoryColors
        });
        return (entity) => (
            categoryColors.get(resolveEntityCategory(entity, colorProperty)) ?? [0.9, 0.2, 0.2, 1]
        );
    }

    private async readSceneSource(input: ExportLineModelInput): Promise<LineEntity[]> {
        const objectKey = buildLineSceneSourceKey(
            input.trajectoryId,
            input.analysisId,
            input.timestep,
            input.exposureId
        );

        return withNativeProcessingTempDir('line-scene-source', async (tempDirectory) => {
            const parquetPath = path.join(tempDirectory, 'lines.parquet');
            try {
                const { stream } = await this.objectStore.getStream(
                    input.ownerClusterId,
                    ObjectBucketName.Models,
                    objectKey
                );
                await pipeline(stream, createWriteStream(parquetPath));
            } catch {
                throw ApplicationError.unprocessableEntity(
                    'LINE_SCENE_SOURCE_NOT_FOUND',
                    `No line scene source found for analysis "${input.analysisId}", exposure "${input.exposureId}" ` +
                    `at timestep ${input.timestep}. Re-run the analysis to enable restyling.`
                );
            }

            const connection = await DuckDBConnection.create();
            try {
                const reader = await connection.runAndReadAll(
                    `SELECT * FROM read_parquet(${sqlString(parquetPath)}) ORDER BY id`
                );
                return (reader.getRowObjects() as unknown as JsonObject[])
                    .map(normalizeParquetRow)
                    .map(toLineEntity);
            } finally {
                connection.closeSync();
            }
        });
    }

    private uploadGlb(buffer: Buffer, objectKey: string, ownerClusterId: string): Promise<void> {
        const isZstdCompressed = objectKey.endsWith('.zst');
        return uploadBufferToObjectStore({
            objectStore: createScopedClusterObjectStore(this.objectStore, ownerClusterId),
            bucket: ObjectBucketName.Models,
            objectKey,
            buffer,
            contentType: 'model/gltf-binary',
            contentEncoding: isZstdCompressed ? 'zstd' : undefined,
            compressionCodec: isZstdCompressed ? 'zstd' : undefined,
            tempDirectory: path.join(DAEMON_PATHS.analysisOutput, 'line-style'),
            tempFilePrefix: 'volt-line-style',
            tempFileSuffix: '.glb'
        });
    }

    private uploadRangesSidecar(
        entityRanges: Parameters<typeof encodeLineRangesSidecar>[0],
        glbObjectKey: string,
        ownerClusterId: string
    ): Promise<void> {
        return uploadBufferToObjectStore({
            objectStore: createScopedClusterObjectStore(this.objectStore, ownerClusterId),
            bucket: ObjectBucketName.Models,
            objectKey: buildLineRangesSidecarKey(glbObjectKey),
            buffer: encodeLineRangesSidecar(entityRanges),
            contentType: 'application/json',
            tempDirectory: path.join(DAEMON_PATHS.analysisOutput, 'line-style'),
            tempFilePrefix: 'volt-line-ranges',
            tempFileSuffix: '.json'
        });
    }
}

export const getLineModelEvaluator = singleton((): LineModelEvaluator => new LineModelEvaluator(getObjectStore()));
