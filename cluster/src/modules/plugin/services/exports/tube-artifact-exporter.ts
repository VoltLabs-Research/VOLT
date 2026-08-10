import fs from 'node:fs/promises';
import path from 'node:path';

import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import {
    buildLineRangesSidecarKey,
    buildLineSceneSourceKey,
    type LineEntityRange
} from '@modules/plugin/services/exports/line-scene-source';
import {
    buildLineGlb,
    encodeLineRangesSidecar,
    generateEmptyLineGLB,
    processLines,
    resolveLineOptions
} from '@modules/plugin/services/exports/line-exporter';
import { stageExportBufferUpload } from '@modules/plugin/services/exports/export-node-processor-shared';
import type {
    BondExportData,
    BondExportOptions,
    ExportExecutionInput,
    ExportMaterial,
    LineEntity,
    LineExportData,
    LineExportOptions
} from '@modules/plugin/services/exports/export-node-processor-types';

/** Stages the GLB and sidecars for the tube-based exporters (lines and bonds). */

const DEFAULT_BOND_RADIUS = 0.15;
const DEFAULT_BOND_TUBULAR_SEGMENTS = 8;
const DEFAULT_BOND_MATERIAL: ExportMaterial = {
    baseColor: [0.78, 0.78, 0.82, 1],
    metallic: 0.1,
    roughness: 0.4,
    emissive: [0, 0, 0]
};

const stageSceneSourceUpload = async (
    input: ExportExecutionInput,
    ownerClusterId: string
): Promise<void> => {
    const objectKey = buildLineSceneSourceKey(
        input.executionData.trajectoryId,
        input.executionData.analysisId,
        input.timestep,
        input.exposure.nodeId
    );

    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Models,
        objectKey,
        buffer: await fs.readFile(input.outputFilePath),
        contentType: 'application/vnd.apache.parquet',
        fileName: path.basename(objectKey)
    });
};

const stageRangesSidecarUpload = async (
    input: ExportExecutionInput,
    glbObjectPath: string,
    ownerClusterId: string,
    entityRanges: LineEntityRange[]
): Promise<void> => {
    const objectKey = buildLineRangesSidecarKey(glbObjectPath);
    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Models,
        objectKey,
        buffer: encodeLineRangesSidecar(entityRanges),
        contentType: 'application/json',
        fileName: path.basename(objectKey)
    });
};

const exportTubeArtifact = async (
    input: ExportExecutionInput,
    exporter: 'LineExporter' | 'BondExporter',
    lines: LineEntity[],
    objectPath: string,
    ownerClusterId: string,
    options: Required<LineExportOptions>
): Promise<boolean> => {
    const geometry = await processLines({ lines }, options);

    await stageExportBufferUpload(input, {
        exporter,
        bucket: ObjectBucketName.Models,
        buffer: geometry
            ? buildLineGlb(geometry, options.material)
            : generateEmptyLineGLB(options.material),
        contentType: 'model/gltf-binary',
        objectPath,
        ownerClusterId
    });

    if (geometry) {
        await stageRangesSidecarUpload(input, objectPath, ownerClusterId, geometry.entityRanges);
    }

    return true;
};

export const exportLineArtifact = async (
    input: ExportExecutionInput,
    exportData: LineExportData,
    objectPath: string,
    ownerClusterId: string,
    options: LineExportOptions
): Promise<boolean> => {
    await stageSceneSourceUpload(input, ownerClusterId);

    return exportTubeArtifact(
        input,
        'LineExporter',
        exportData.lines,
        objectPath,
        ownerClusterId,
        resolveLineOptions(options)
    );
};

export const exportBondArtifact = (
    input: ExportExecutionInput,
    exportData: BondExportData,
    objectPath: string,
    ownerClusterId: string,
    options: BondExportOptions
): Promise<boolean> => exportTubeArtifact(
    input,
    'BondExporter',
    exportData.bonds,
    objectPath,
    ownerClusterId,
    resolveLineOptions({
        ...options,
        lineWidth: (options.radius ?? DEFAULT_BOND_RADIUS) * 2,
        tubularSegments: options.tubularSegments ?? DEFAULT_BOND_TUBULAR_SEGMENTS,
        material: {
            ...DEFAULT_BOND_MATERIAL,
            ...options.material
        }
    })
);
