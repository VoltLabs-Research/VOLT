import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectInlineExposureArtifacts } from './AnalysisWorker';

test('AnalysisWorker nested exposure collection omits missing files', async () => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-node-test-'));
    const existingFilePath = `${tempDirectory}_existing.msgpack`;
    await fs.writeFile(existingFilePath, 'ok');

    const artifacts = await collectInlineExposureArtifacts({
        nodes: [{
            id: 'exposure-1',
            type: 'exposure',
            position: { x: 0, y: 0 },
            data: {
                exposure: {
                    name: 'Existing Exposure',
                    results: 'existing.msgpack'
                }
            }
        }, {
            id: 'exposure-2',
            type: 'exposure',
            position: { x: 0, y: 0 },
            data: {
                exposure: {
                    name: 'Missing Exposure',
                    results: 'missing.msgpack'
                }
            }
        }],
        edges: []
    }, tempDirectory);

    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].exposureId, 'exposure-1');

    await fs.rm(tempDirectory, { recursive: true, force: true });
    await fs.rm(existingFilePath, { force: true });
});

test('AnalysisWorker nested exposure collection returns empty array when none exist', async () => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-node-test-empty-'));

    const artifacts = await collectInlineExposureArtifacts({
        nodes: [{
            id: 'exposure-1',
            type: 'exposure',
            position: { x: 0, y: 0 },
            data: {
                exposure: {
                    name: 'Missing Exposure',
                    results: 'missing.msgpack'
                }
            }
        }],
        edges: []
    }, tempDirectory);

    assert.deepEqual(artifacts, []);
    assert.equal(JSON.stringify(artifacts), '[]');

    await fs.rm(tempDirectory, { recursive: true, force: true });
});
