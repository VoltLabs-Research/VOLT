import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportOctreeMetadata, buildOctreeMetadataSidecarKey } from '@/modules/plugin/application/exports/octree-exporter';
import type { ExportExecutionInput } from '@/modules/plugin/application/exports/export-node-processor-types';
import type { OctreeMetadata } from '@/shared/octree';

interface StagedUpload {
    objectKey: string;
    buffer: Buffer;
    contentType: string;
}

const buildPositions = (count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    const side = Math.ceil(Math.cbrt(count));
    for (let i = 0; i < count; i += 1) {
        positions[i * 3] = i % side;
        positions[i * 3 + 1] = Math.floor(i / side) % side;
        positions[i * 3 + 2] = Math.floor(i / (side * side));
    }
    return positions;
};

const buildInput = (staged: StagedUpload[]): ExportExecutionInput => ({
    executionData: { analysisId: 'a', trajectoryId: 't', pluginId: 'p', storageClusterId: 'c' },
    exposure: {
        nodeId: 'atoms-exposure',
        name: 'Atoms',
        results: 'atoms.parquet',
        export: { exporter: 'AtomisticExporter', type: 'glb', options: {} }
    } as unknown as ExportExecutionInput['exposure'],
    decodedPayload: {},
    outputFilePath: '/tmp/does-not-matter.parquet',
    timestep: 0,
    storageClusterId: 'c',
    artifactUploadBatch: {
        stageBufferUpload: async (args: { objectKey: string; buffer: Buffer; contentType: string }) => {
            staged.push({ objectKey: args.objectKey, buffer: args.buffer, contentType: args.contentType });
        }
    } as unknown as ExportExecutionInput['artifactUploadBatch']
});

describe('buildOctreeMetadataSidecarKey', () => {
    it('keys to the logical GLB, stripping a .zst storage suffix', () => {
        assert.equal(buildOctreeMetadataSidecarKey('a/b/atoms.glb'), 'a/b/atoms.glb.octree.json');
        assert.equal(buildOctreeMetadataSidecarKey('a/b/atoms.glb.zst'), 'a/b/atoms.glb.octree.json');
    });
});

describe('exportOctreeMetadata', () => {
    const glbPath = 'trajectory-t/analysis-a/glb/0/atoms-exposure.glb';

    it('returns null and stages nothing when disabled', async () => {
        const staged: StagedUpload[] = [];
        const result = await exportOctreeMetadata(buildInput(staged), buildPositions(1000), 1000, glbPath, 'c', { enabled: false });
        assert.equal(result, null);
        assert.equal(staged.length, 0);
    });

    it('returns null when atom count is below the octree threshold', async () => {
        const staged: StagedUpload[] = [];
        const result = await exportOctreeMetadata(
            buildInput(staged),
            buildPositions(500),
            500,
            glbPath,
            'c',
            { enabled: true, minAtomsForOctree: 1000 }
        );
        assert.equal(result, null);
        assert.equal(staged.length, 0);
    });

    it('bakes a valid octree JSON sidecar next to the GLB for a large cloud', async () => {
        const staged: StagedUpload[] = [];
        const atomCount = 5000;
        const metadata = await exportOctreeMetadata(
            buildInput(staged),
            buildPositions(atomCount),
            atomCount,
            glbPath,
            'c',
            { enabled: true, minAtomsForOctree: 1000, leafCellMaxAtoms: 256, maxDepth: 8 }
        );

        assert.ok(metadata, 'metadata returned');
        assert.equal(staged.length, 1, 'exactly one sidecar staged');

        const sidecar = staged[0];
        assert.equal(sidecar.objectKey, `${glbPath}.octree.json`, 'keyed next to the GLB');
        assert.equal(sidecar.contentType, 'application/json');

        const parsed = JSON.parse(sidecar.buffer.toString('utf8')) as OctreeMetadata;
        assert.equal(parsed.version, 1);
        assert.ok(parsed.cells.length > 1, 'subdivided into multiple cells');
        assert.ok(parsed.geometryBudget, 'embeds the default geometry budget');
        assert.equal(parsed.geometryBudget?.perFeature.points.maxGeometry, 100_000_000);

        const root = parsed.cells[0];
        assert.equal(root.level, 0);
        assert.equal(root.atomCount, atomCount);
        const leafTotal = parsed.cells
            .filter((c) => !c.childIndices || c.childIndices.length === 0)
            .reduce((sum, c) => sum + c.atomCount, 0);
        assert.equal(leafTotal, atomCount, 'leaves partition all atoms');
    });
});
