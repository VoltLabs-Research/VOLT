import { ErrorCodes } from '@core/constants/error-codes';
import { singleton } from '@shared/application/utilities/singleton';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { DuckDBConnection } from '@duckdb/node-api';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ObjectBucketName } from '@shared/contracts';
import { DAEMON_PATHS } from '@core/config/paths';
import { createScopedClusterObjectStore, type ClusterObjectStore, getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { uploadBufferToObjectStore } from '@shared/infrastructure/storage/upload-buffer-to-object-store';
import { normalizeParquetRow } from '@modules/analysis/services/workflow/exposure-payload-reader';
import {
    buildLineRangesSidecarKey,
    buildLineSceneSourceKey
} from '@modules/plugin/services/exports/line-scene-source';
import {
    buildLineGlb,
    encodeLineRangesSidecar,
    generateEmptyLineGLB,
    processLines
} from '@modules/plugin/services/exports/line-exporter';
import { uploadGlbBuffer } from '@modules/trajectory/services/glb/upload-glb-buffer';
import {
    resolveLineStyle,
    resolveStyledLineOptions,
    type LineStyleInput
} from '@modules/trajectory/services/line-style-resolver';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import type { JsonObject } from '@shared/contracts/types/json';

import type {
    LineEntity,
    LineExportOptions
} from '@modules/plugin/services/exports/export-node-processor-types';

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

export class LineModelEvaluator {
    constructor(private readonly objectStore: ClusterObjectStore) {}

    async exportLineModel(input: ExportLineModelInput): Promise<ExportLineModelResult> {
        const lines = await this.readSceneSource(input);
        const options = resolveStyledLineOptions(input.baseOptions ?? {}, input.style ?? {});
        const style = resolveLineStyle(lines, options, input.style ?? {});

        let entitiesRendered = 0;
        const geometry = await processLines({ lines }, options, {
            includeEntity: (entity) => {
                if (!style.includeEntity(entity)) {
                    return false;
                }
                entitiesRendered += 1;
                return true;
            },
            getEntityColor: style.getEntityColor
        });

        const buffer = geometry
            ? buildLineGlb(geometry, options.material)
            : generateEmptyLineGLB(options.material);

        await uploadGlbBuffer(this.objectStore, buffer, input.objectKey, input.ownerClusterId);
        await this.uploadRangesSidecar(geometry?.entityRanges ?? [], input.objectKey, input.ownerClusterId);

        return {
            objectKey: input.objectKey,
            entitiesRendered,
            entitiesTotal: lines.length,
            categoryCounts: style.categoryCounts
        };
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
                    ErrorCodes.LINE_SCENE_SOURCE_NOT_FOUND,
                    `No line scene source found for analysis "${input.analysisId}", exposure "${input.exposureId}" ` +
                    `at timestep ${input.timestep}. Re-run the analysis to enable restyling.`
                );
            }

            const connection = await DuckDBConnection.create();
            try {
                const reader = await connection.runAndReadAll(
                    `SELECT * FROM read_parquet(${sqlString(parquetPath)}) ORDER BY id`
                );
                // normalizeParquetRow is the conversion from raw DuckDB values to JSON, but it
                // declares its input as JsonObject, so the raw row has to be asserted going in.
                return (reader.getRowObjects() as JsonObject[])
                    .map(normalizeParquetRow)
                    .map(toLineEntity);
            } finally {
                connection.closeSync();
            }
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
