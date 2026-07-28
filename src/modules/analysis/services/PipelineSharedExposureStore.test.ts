import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PipelineSharedExposureStore } from '@modules/analysis/services/PipelineSharedExposureStore';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';

const buildStore = (contents: Record<string, string>): PipelineSharedExposureStore => {
    const objectStore = {
        list: async (_owner: string, request: { prefix: string }) => ({
            keys: Object.keys(contents).filter((key) => key.startsWith(request.prefix)),
            nextCursor: undefined
        }),
        getStream: async (_owner: string, _bucket: string, objectKey: string) => ({
            metadata: {},
            stream: Readable.from([Buffer.from(contents[objectKey])])
        })
    } as unknown as ClusterObjectStore;

    return new PipelineSharedExposureStore(objectStore);
};

test('fetch keeps same-basename exposures on distinct local paths', async () => {
    const store = buildStore({
        'plugins/trajectory-t1/analysis-a1/shared-clusters_table/timestep-75000.table': 'cluster_id\ttopology_name\n',
        'plugins/trajectory-t1/analysis-a1/shared-clusters_transitions/timestep-75000.table': 'cluster1_id\tcluster2_id\n'
    });

    const destinationDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-exposure-'));
    const base = {
        ownerClusterId: 'c1',
        trajectoryId: 't1',
        analysisId: 'a1',
        timestep: 75000,
        destinationDir
    };

    const tablePath = await store.fetch({ ...base, exposureId: 'clusters_table' });
    const transitionsPath = await store.fetch({ ...base, exposureId: 'clusters_transitions' });

    assert.ok(tablePath && transitionsPath);
    assert.notEqual(tablePath, transitionsPath, 'the two .table fetches must not collide');
    assert.match(await fs.readFile(tablePath, 'utf8'), /^cluster_id\t/);
    assert.match(await fs.readFile(transitionsPath, 'utf8'), /^cluster1_id\t/);

    await fs.rm(destinationDir, { recursive: true, force: true });
});
