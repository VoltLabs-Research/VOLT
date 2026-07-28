import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import {
    buildLineRangesSidecarKey,
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
    LineEntity
} from '@modules/plugin/services/exports/export-node-processor-types';

export const DEFAULT_BOND_OPTIONS: Required<BondExportOptions> = {
    radius: 0.15,
    tubularSegments: 8,
    material: {
        baseColor: [0.78, 0.78, 0.82, 1],
        metallic: 0.1,
        roughness: 0.4,
        emissive: [0, 0, 0]
    },
    colorBy: '',
    propertyColors: {}
};

const resolveBondOptions = (options: BondExportOptions): Required<BondExportOptions> => ({
    ...DEFAULT_BOND_OPTIONS,
    ...options,
    material: { ...DEFAULT_BOND_OPTIONS.material, ...options.material }
});

const bondToLineEntity = (bond: BondExportData['bonds'][number]): LineEntity => {
    const { points, ...properties } = bond;
    return { ...properties, id: bond.id, points };
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
        fileName: objectKey.split('/').pop() ?? objectKey
    });
};

export const exportBondArtifact = async (
    input: ExportExecutionInput,
    exportData: BondExportData,
    objectPath: string,
    ownerClusterId: string,
    options: BondExportOptions
): Promise<boolean> => {
    const resolvedOptions = resolveBondOptions(options);

    const lineOptions = resolveLineOptions({
        lineWidth: resolvedOptions.radius * 2,
        tubularSegments: resolvedOptions.tubularSegments,
        minSegmentPoints: 2,
        material: resolvedOptions.material,
        colorBy: resolvedOptions.colorBy,
        propertyColors: resolvedOptions.propertyColors
    });

    const lines = exportData.bonds.map(bondToLineEntity);
    const geometry = await processLines({ lines }, lineOptions);

    if (!geometry) {
        await stageExportBufferUpload(input, {
            exporter: 'BondExporter',
            bucket: ObjectBucketName.Models,
            buffer: generateEmptyLineGLB(lineOptions.material),
            contentType: 'model/gltf-binary',
            objectPath,
            ownerClusterId
        });
        return true;
    }

    const buffer = buildLineGlb(geometry, lineOptions.material);

    await stageExportBufferUpload(input, {
        exporter: 'BondExporter',
        bucket: ObjectBucketName.Models,
        buffer,
        contentType: 'model/gltf-binary',
        objectPath,
        ownerClusterId
    });
    await stageRangesSidecarUpload(input, objectPath, ownerClusterId, geometry.entityRanges);

    return true;
};
