import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import {
    buildLineRangesSidecarKey,
    type LineEntityRange
} from '@/modules/plugin/application/exports/line-scene-source';
import {
    buildLineGlb,
    encodeLineRangesSidecar,
    generateEmptyLineGLB,
    processLines,
    resolveLineOptions
} from '@/modules/plugin/application/exports/line-exporter';
import { stageExportBufferUpload } from '@/modules/plugin/application/exports/export-node-processor-shared';
import type {
    BondExportData,
    BondExportOptions,
    ExportExecutionInput,
    LineEntity
} from '@/modules/plugin/application/exports/export-node-processor-types';

export const DEFAULT_BOND_OPTIONS: Required<BondExportOptions> = {
    // Bonds render thinner than dislocation lines by default; a 0.15 Å cylinder
    // radius → 0.30 Å diameter matches OVITO's default bond width.
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

// A bond is a two-vertex polyline (its endpoints already carry the periodic
// image shift, so the segment is continuous across the cell). It triangulates
// to a cylinder through exactly the same tube path dislocation lines use — the
// bond exporter is a thin specialization of the line exporter with bond-tuned
// defaults, not a parallel geometry implementation.
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
    // No reportArtifact: picking metadata rides next to the GLB (same contract
    // as the line exporter, so bond click-picking resolves a triangle → bond id).
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

    // processLines consumes lineWidth (diameter); a bond's radius is half of it.
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
