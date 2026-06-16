import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { logger } from '@/core/logger';
import {
    buildOctreeMetadata,
    DEFAULT_GEOMETRY_BUDGET,
    type OctreeMetadata
} from '@/shared/octree';
import type {
    ExportExecutionInput,
    OctreeExportOptions
} from '@/modules/plugin/application/exports/export-node-processor-types';

const DEFAULT_LEAF_CELL_MAX_ATOMS = 50_000;
const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MIN_ATOMS_FOR_OCTREE = 100_000;

export const buildOctreeMetadataSidecarKey = (glbObjectKey: string): string => (
    `${glbObjectKey.replace(/\.zst$/, '')}.octree.json`
);

const resolveOctreeOptions = (options: OctreeExportOptions): Required<Omit<OctreeExportOptions, 'enabled'>> => ({
    leafCellMaxAtoms: options.leafCellMaxAtoms ?? DEFAULT_LEAF_CELL_MAX_ATOMS,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    minAtomsForOctree: options.minAtomsForOctree ?? DEFAULT_MIN_ATOMS_FOR_OCTREE,
    geometryBudget: options.geometryBudget ?? DEFAULT_GEOMETRY_BUDGET
});

export const exportOctreeMetadata = async (
    input: ExportExecutionInput,
    positions: Float32Array,
    atomCount: number,
    glbObjectPath: string,
    ownerClusterId: string,
    options: OctreeExportOptions
): Promise<OctreeMetadata | null> => {
    if (!options.enabled) {
        return null;
    }

    const resolved = resolveOctreeOptions(options);
    if (atomCount < resolved.minAtomsForOctree) {
        return null;
    }

    const metadata = buildOctreeMetadata(positions, atomCount, {
        leafCellMaxAtoms: resolved.leafCellMaxAtoms,
        maxDepth: resolved.maxDepth,
        geometryBudget: resolved.geometryBudget
    });

    const objectKey = buildOctreeMetadataSidecarKey(glbObjectPath);
    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Models,
        objectKey,
        buffer: Buffer.from(JSON.stringify(metadata), 'utf8'),
        contentType: 'application/json',
        fileName: objectKey.split('/').pop() ?? objectKey
    });

    logger.debug(
        {
            analysisId: input.executionData.analysisId,
            atomCount,
            cells: metadata.cells.length,
            maxDepth: metadata.maxDepth
        },
        'Baked LOD octree metadata sidecar'
    );

    return metadata;
};
