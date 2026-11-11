import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { DataSource } from 'typeorm';
import { getModelStream, stripModelEncoding } from '@shared/utilities/model-stream';
import { renameLegacyModelObjects } from '@core/bootstrap/rename-legacy-model-objects';

test('a model is sent as stored, gzip-encoded and cacheable for good', async () => {
    const stream = Readable.from([Buffer.from('gz')]);
    const lastModified = new Date('2026-11-01T00:00:00Z');
    const requested: string[] = [];
    const output = await getModelStream({
        getStream: async (_cluster, bucket, objectKey) => {
            requested.push(`${bucket}/${objectKey}`);
            return {
                stream,
                contentLength: 2,
                etag: 'abc',
                lastModified,
                metadata: {},
                headers: {}
            };
        }
    }, 'cluster-1', 'trajectory-t/timestep-10.glb.gz');

    assert.equal(output.stream, stream);
    assert.deepEqual(requested, ['volt-models/trajectory-t/timestep-10.glb.gz']);
    assert.deepEqual(output.headers, {
        'Content-Type': 'model/gltf-binary',
        'Content-Encoding': 'gzip',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': 'inline; filename="timestep-10.glb"',
        'Content-Length': '2',
        ETag: 'abc',
        'Last-Modified': lastModified.toUTCString()
    });
});

test('only model objects are served as models', async () => {
    await assert.rejects(getModelStream({ getStream: async () => { throw new Error('unreachable'); } }, 'c', 'a/b.dump.zst'));
});

test('sidecars keep the name of the model without its encoding', () => {
    assert.equal(stripModelEncoding('a/b/primary-exposure.glb.gz'), 'a/b/primary-exposure.glb');
    assert.equal(stripModelEncoding('a/b/primary-exposure.glb'), 'a/b/primary-exposure.glb');
});

test('scene artifacts that point at zstd models move to the gzip names once', async () => {
    const dataSource = new DataSource({
        type: 'better-sqlite3',
        database: ':memory:'
    });
    await dataSource.initialize();
    try {
        await dataSource.query('CREATE TABLE trajectory_scene_artifacts (id INTEGER PRIMARY KEY, "objectName" TEXT)');
        await dataSource.query(`INSERT INTO trajectory_scene_artifacts ("objectName") VALUES
            ('trajectory-a/analysis-b/glb/10/primary-exposure.glb.zst'),
            ('trajectory-a/analysis-b/glb/10/structure.glb.gz'),
            ('trajectory-a/analysis-b/charts/10/chart.png')`);

        await renameLegacyModelObjects(dataSource);
        await renameLegacyModelObjects(dataSource);

        const rows = await dataSource.query('SELECT "objectName" FROM trajectory_scene_artifacts ORDER BY id');
        assert.deepEqual(rows.map((row: { objectName: string }) => row.objectName), [
            'trajectory-a/analysis-b/glb/10/primary-exposure.glb.gz',
            'trajectory-a/analysis-b/glb/10/structure.glb.gz',
            'trajectory-a/analysis-b/charts/10/chart.png'
        ]);
    } finally {
        await dataSource.destroy();
    }
});
