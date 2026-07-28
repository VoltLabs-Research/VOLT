import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportBondArtifact } from '@modules/plugin/services/exports/bond-exporter';
import type {
    BondExportData,
    ExportExecutionInput
} from '@modules/plugin/services/exports/export-node-processor-types';

interface StagedUpload {
    objectKey: string;
    buffer: Buffer;
    contentType: string;
}

const buildBondData = (): BondExportData => ({
    bonds: [
        { id: 0, points: [[0, 0, 0], [1.5, 0, 0]], atom_a: 0, atom_b: 1, distance: 1.5, bond_order: 1 },
        { id: 1, points: [[0, 0, 0], [0, 1.5, 0]], atom_a: 0, atom_b: 2, distance: 1.5, bond_order: 2 }
    ]
});

const buildInput = (staged: StagedUpload[]): ExportExecutionInput => ({
    executionData: { analysisId: 'a', trajectoryId: 't', pluginId: 'p', storageClusterId: 'c' },
    exposure: {
        nodeId: 'bonds-exposure',
        name: 'Bonds',
        results: 'bonds.parquet',
        export: { exporter: 'BondExporter', type: 'glb', options: { radius: 0.15 } }
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

describe('exportBondArtifact', () => {
    it('bakes a non-empty GLB cylinder mesh + a ranges sidecar from the bond table', async () => {
        const staged: StagedUpload[] = [];
        const objectPath = 'trajectory-t/analysis-a/glb/0/bonds-exposure.glb';

        const ok = await exportBondArtifact(buildInput(staged), buildBondData(), objectPath, 'c', { radius: 0.15 });

        assert.equal(ok, true);

        const glb = staged.find((u) => u.objectKey === objectPath);
        assert.ok(glb, 'GLB artifact was staged at the object path');
        assert.equal(glb.contentType, 'model/gltf-binary');
        assert.equal(glb.buffer.subarray(0, 4).toString('ascii'), 'glTF', 'buffer is a valid GLB');

        const sidecar = staged.find((u) => u.objectKey === `${objectPath}.ranges.json`);
        assert.ok(sidecar, 'ranges sidecar was staged next to the GLB');
        const decoded = JSON.parse(sidecar.buffer.toString('utf8')) as { entities: { id: number }[] };
        assert.deepEqual(decoded.entities.map((e) => e.id).sort(), [0, 1], 'one range per bond, keyed by bond id');
    });

    it('stages an empty GLB (no sidecar) when there are no bonds', async () => {
        const staged: StagedUpload[] = [];
        const objectPath = 'trajectory-t/analysis-a/glb/0/bonds-exposure.glb';

        const ok = await exportBondArtifact(buildInput(staged), { bonds: [] }, objectPath, 'c', {});

        assert.equal(ok, true);
        assert.equal(staged.length, 1, 'only the empty GLB is staged');
        assert.equal(staged[0].objectKey, objectPath);
        assert.equal(staged[0].buffer.subarray(0, 4).toString('ascii'), 'glTF');
    });
});
