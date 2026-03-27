import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@/modules/platform/services';

import { createArtifactUploadQueueService } from './ArtifactUploadQueueService';

class StubQueueService {
    public readonly enqueueCalls: Array<{
        queueName: string;
        payload: Record<string, unknown>;
        options: Record<string, unknown>;
    }> = [];

    async enqueue(queueName: string, payload: Record<string, unknown>, options: Record<string, unknown>): Promise<boolean> {
        this.enqueueCalls.push({ queueName, payload, options });
        return true;
    }
}

test('ArtifactUploadQueueService stages files and buffers into a single batch job', async () => {
    const queueService = new StubQueueService();
    const service = createArtifactUploadQueueService(queueService as never);
    const sourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-upload-source-'));
    const sourcePath = path.join(sourceDirectory, 'result.msgpack');
    await fs.writeFile(sourcePath, Buffer.from('source-payload'));

    const batch = service.createBatch({
        analysisId: 'analysis-1',
        analysisJobId: 'analysis-1-25',
        teamId: 'team-1',
        trajectoryId: 'trajectory-1',
        trajectoryName: 'Trajectory 1',
        timestep: 25_000
    });

    try {
        await batch.stageFileUpload({
            sourcePath,
            ownerClusterId: 'storage-1',
            bucket: 'volt-plugins',
            objectKey: 'plugins/analysis-1/frame-25.msgpack',
            contentType: 'application/msgpack'
        });
        await batch.stageBufferUpload({
            ownerClusterId: 'storage-1',
            bucket: 'volt-models',
            objectKey: 'models/analysis-1/frame-25.glb',
            buffer: Buffer.from('buffer-payload'),
            contentType: 'model/gltf-binary'
        });

        const enqueueResult = await batch.enqueue();
        assert.equal(enqueueResult.queuedUploads, 2);
        assert.equal(enqueueResult.jobId, 'artifact-upload-analysis-1-25');
        assert.equal(queueService.enqueueCalls.length, 1);
        assert.equal(queueService.enqueueCalls[0]?.queueName, ARTIFACT_UPLOAD_QUEUE_NAME);
        assert.equal(queueService.enqueueCalls[0]?.options.attempts, 6);
        assert.equal(queueService.enqueueCalls[0]?.options.removeOnFail, false);
        assert.equal(queueService.enqueueCalls[0]?.options.preserveExistingJob, true);

        const payload = queueService.enqueueCalls[0]?.payload as {
            jobId: string;
            teamId: string;
            trajectoryId: string;
            timestep: number;
            uploads: Array<{ sourcePath: string; }>;
            batchDirectory: string;
        };

        assert.equal(payload.jobId, 'artifact-upload-analysis-1-25');
        assert.equal(payload.teamId, 'team-1');
        assert.equal(payload.trajectoryId, 'trajectory-1');
        assert.equal(payload.timestep, 25_000);
        assert.equal(payload.uploads.length, 2);
        for (const upload of payload.uploads) {
            await fs.access(upload.sourcePath);
        }

        await batch.cleanup();
        await fs.access(payload.batchDirectory);

        await fs.rm(payload.batchDirectory, { recursive: true, force: true });
    } finally {
        await fs.rm(sourceDirectory, { recursive: true, force: true });
    }
});

test('ArtifactUploadQueueService cleanup removes staged files before enqueue', async () => {
    const queueService = new StubQueueService();
    const service = createArtifactUploadQueueService(queueService as never);
    const batch = service.createBatch({
        analysisId: 'analysis-2',
        analysisJobId: 'analysis-2-50',
        teamId: 'team-2',
        trajectoryId: 'trajectory-2',
        timestep: 50_000
    });

    await batch.stageBufferUpload({
        ownerClusterId: 'storage-1',
        bucket: 'volt-models',
        objectKey: 'models/analysis-2/frame-50.glb',
        buffer: Buffer.from('buffer-payload'),
        contentType: 'model/gltf-binary'
    });

    await batch.cleanup();
    await assert.rejects(() => batch.enqueue(), /already been enqueued/);
    assert.equal(queueService.enqueueCalls.length, 0);
});
