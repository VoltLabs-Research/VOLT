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

// LOD octree metadata is baked alongside the point-cloud GLB, not in place of
// it: this sidecar carries the cell hierarchy (bounds + tier structure + per-tier
// draw budgets) the client LOD manager reads to fetch only visible-region tiles.
// That on-demand streaming is what lets VOLT hold the 100M-atom claim instead of
// uploading one monolithic buffer.

const DEFAULT_LEAF_CELL_MAX_ATOMS = 50_000;
const DEFAULT_MAX_DEPTH = 10;
// Below this, a point cloud renders whole — an octree would be all overhead.
const DEFAULT_MIN_ATOMS_FOR_OCTREE = 100_000;

// Keyed to the logical GLB, not its storage encoding (baked exports stage the
// pre-compression `.glb` key, styled re-exports the stored `.glb.zst` key) so
// both resolve to the same sidecar name — the same convention as the line/bond
// `.ranges.json` sidecars.
export const buildOctreeMetadataSidecarKey = (glbObjectKey: string): string => (
    `${glbObjectKey.replace(/\.zst$/, '')}.octree.json`
);

const resolveOctreeOptions = (options: OctreeExportOptions): Required<Omit<OctreeExportOptions, 'enabled'>> => ({
    leafCellMaxAtoms: options.leafCellMaxAtoms ?? DEFAULT_LEAF_CELL_MAX_ATOMS,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    minAtomsForOctree: options.minAtomsForOctree ?? DEFAULT_MIN_ATOMS_FOR_OCTREE,
    geometryBudget: options.geometryBudget ?? DEFAULT_GEOMETRY_BUDGET
});

// Bakes the octree sidecar for a point cloud. No-op (returns null) when disabled
// or below the atom threshold, so small clouds skip the cost. Positions are the
// interleaved xyz Float32Array the atomistic exporter already assembled — the
// octree reuses it rather than re-reading the parquet.
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
    // No reportArtifact: LOD metadata rides next to the GLB exactly like the
    // line/bond ranges sidecars, discovered from the GLB key, not listed as its
    // own scene artifact.
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
