import type { DuckDBConnection } from '@duckdb/node-api';
import type { ArtifactUploadBatch, ArtifactUploadStageBufferInput } from '@shared/contracts/types/artifact-upload';
import type { ExportExecutionInput } from '@modules/plugin/services/exports/export-node-processor-types';
import type { JsonObject } from '@shared/contracts/types/json';
import type { SubListingBatchSource } from '@shared/contracts/types/workflow-exposure';

export const writePayloadParquet = async (
    connection: DuckDBConnection,
    document: string,
    target: string
): Promise<void> => {
    const escaped = document.replace(/'/g, "''");
    await connection.run(
        `COPY (SELECT '${escaped}' AS payload) TO '${target}' (FORMAT PARQUET)`
    );
};

export const collectSubListingRows = async (
    sources: SubListingBatchSource[]
): Promise<Record<string, JsonObject[]>> => {
    const collected: Record<string, JsonObject[]> = {};
    for (const source of sources) {
        const rows: JsonObject[] = [];
        for await (const batch of source.readBatches()) {
            rows.push(...batch);
        }
        if (rows.length !== source.rowCount) {
            throw new Error(
                `sub-listing ${source.name}: rowCount=${source.rowCount} pero llegaron ${rows.length} filas`
            );
        }
        collected[source.name] = rows;
    }
    return collected;
};

export const buildExportInput = (
    exporter: string,
    outputDirectory: string
): {
    input: ExportExecutionInput;
    staged: Buffer[];
} => {
    const staged: Buffer[] = [];
    const artifactUploadBatch: ArtifactUploadBatch = {
        stageBufferUpload: (stageInput: ArtifactUploadStageBufferInput): Promise<void> => {
            staged.push(stageInput.buffer);
            return Promise.resolve();
        },
        enqueue: () => Promise.resolve({ queuedUploads: staged.length }),
        cleanup: () => Promise.resolve()
    };

    return {
        staged,
        input: {
            executionData: {
                analysisId: 'analysis-check',
                trajectoryId: 'trajectory-check',
                pluginId: 'plugin-check',
                storageClusterId: 'cluster-1'
            },
            exposure: {
                nodeId: 'exposure-check',
                name: 'Check',
                results: 'check.parquet',
                'export': {
                    exporter,
                    type: 'glb'
                }
            },
            decodedPayload: {},
            outputFilePath: outputDirectory,
            timestep: 0,
            storageClusterId: 'cluster-1',
            artifactUploadBatch
        }
    };
};
