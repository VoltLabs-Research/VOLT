import assert from 'node:assert/strict';
import test from 'node:test';
import { createTrajectoryGlbQueueService } from './TrajectoryGlbQueueService';

class StubQueueService {
    public enqueueBulkCalls: Array<{ queueName: string; payloads: Record<string, unknown>[]; }> = [];

    async enqueueBulk(queueName: string, payloads: Record<string, unknown>[]): Promise<void> {
        this.enqueueBulkCalls.push({ queueName, payloads });
    }
}

test('TrajectoryGlbQueueService bulk-enqueues GLB jobs for all valid frames', async () => {
    const queueService = new StubQueueService();
    const service = createTrajectoryGlbQueueService({} as never, queueService as never);

    const result = await service.enqueueGlbConversionJobs({
        trajectoryId: 'trajectory-1',
        teamId: 'team-1',
        trajectoryName: 'Trajectory 1',
        storageClusterId: 'storage-1',
        frames: [
            { timestep: 25_000, objectKey: 'trajectory-1/25000.dump' },
            { timestep: 50_000, objectKey: 'trajectory-1/50000.dump' }
        ]
    });

    assert.deepEqual(result, {
        queuedJobs: 2,
        duplicateJobs: 0,
        skippedJobs: 0
    });
    assert.equal(queueService.enqueueBulkCalls.length, 1);
    assert.equal(queueService.enqueueBulkCalls[0]?.queueName, 'trajectory_glb_conversion');
    assert.deepEqual(
        queueService.enqueueBulkCalls[0]?.payloads.map((payload) => payload.jobId),
        [
            'trajectory-glb:trajectory-1:25000',
            'trajectory-glb:trajectory-1:50000'
        ]
    );
});

test('TrajectoryGlbQueueService skips frames that do not resolve an owner cluster', async () => {
    const queueService = new StubQueueService();
    const service = createTrajectoryGlbQueueService({} as never, queueService as never);

    const result = await service.enqueueGlbConversionJobs({
        trajectoryId: 'trajectory-2',
        teamId: 'team-1',
        trajectoryName: 'Trajectory 2',
        storageClusterId: '',
        frames: [
            { timestep: 75_000, objectKey: 'trajectory-2/75000.dump' }
        ]
    });

    assert.deepEqual(result, {
        queuedJobs: 0,
        duplicateJobs: 0,
        skippedJobs: 1
    });
    assert.equal(queueService.enqueueBulkCalls.length, 0);
});
