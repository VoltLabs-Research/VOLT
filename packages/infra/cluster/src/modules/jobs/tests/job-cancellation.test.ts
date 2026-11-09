import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { connectDaemonDataSource, disconnectDaemonDataSource, getDaemonDataSource } from '@shared/persistence/DataSource';
import { getDaemonEntities } from '@core/bootstrap/entities';
import { getQueueService } from '@shared/queues/QueueService';
import { getQueueJobStore } from '@shared/queues/queue-job-store';
import { getJobCancellationRegistry, throwIfAborted, throwIfJobCancelled } from '@shared/queues/job-cancellation';
import { getRuntimeStateCleanupControl } from '@modules/jobs/services/RuntimeStateCleanupControl';
import { getJobControl } from '@modules/jobs/services/JobControl';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { getEventDispatcher } from '@shared/events/EventDispatcher';
import { getFilesystemObjectStore } from '@shared/storage/FilesystemObjectStore';
import { PIPELINE_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@core/constants/queue-names';

let objectStoreRoot = '';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate: () => boolean, timeoutMs = 10_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error('waitFor timed out');
        await wait(20);
    }
};

const countJobsOf = async (trajectoryId: string): Promise<number> => {
    const rows = await getDaemonDataSource().manager.query<{ total: number }[]>(
        `SELECT count(*) AS total FROM queue_jobs WHERE json_extract(payload, '$.trajectoryId') = ?`,
        [trajectoryId]
    );
    return Number(rows[0].total);
};

const publishedJobIds = async (operation: () => Promise<void>): Promise<string[]> => {
    const dispatcher = getEventDispatcher();
    const publish = dispatcher.publish.bind(dispatcher);
    const published: string[] = [];
    dispatcher.publish = async (event) => {
        published.push(String((event as unknown as { payload?: { jobId?: string } }).payload?.jobId));
    };
    try {
        await operation();
    } finally {
        dispatcher.publish = publish;
    }
    return published;
};

before(async () => {
    objectStoreRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'volt-job-cancellation-'));
    process.env.DATABASE_URL = 'sqlite::memory:';
    process.env.OBJECT_STORE_ROOT = objectStoreRoot;
    process.env.TEAM_CLUSTER_ID ??= 'cluster-test';
    process.env.TEAM_CLUSTER_DAEMON_PASSWORD ??= 'test';
    process.env.VOLT_CLOUD_URL ??= 'http://localhost';

    await connectDaemonDataSource(getDaemonEntities());
});

after(async () => {
    await disconnectDaemonDataSource();
    fs.rmSync(objectStoreRoot, {
 recursive: true, force: true 
});
});

describe('trajectory runtime cleanup', () => {
    // The worker checks only its job's signal and the object store refuses the write by key,
    // as in the browser runtime, whose AsyncLocalStorage keeps no context across awaits.
    test('cancels the running job, removes the queued ones and refuses new jobs and writes', async () => {
        const queue = getQueueService();
        const started: string[] = [];
        let refusedWrite: unknown = null;

        const worker = queue.createWorker<{ jobId: string; trajectoryId: string }>(
            TRAJECTORY_RASTER_QUEUE_NAME,
            async (payload, job) => {
                started.push(payload.jobId);
                if (payload.trajectoryId !== 'trajectory-deleted') return;

                while (!job.signal.aborted) {
                    await wait(10);
                }
                try {
                    await getFilesystemObjectStore().putObjectStream({
                        bucket: 'rasterizer',
                        objectKey: `trajectory-${payload.trajectoryId}/previews/late.png`,
                        stream: Readable.from([Buffer.from('late')]),
                        size: 4
                    });
                } catch (error) {
                    refusedWrite = error;
                }
                throwIfAborted(job.signal);
            },
            { concurrency: 1 }
        );

        try {
            await queue.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, {
 jobId: 'raster-1', trajectoryId: 'trajectory-deleted' 
});
            await queue.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, {
 jobId: 'raster-2', trajectoryId: 'trajectory-deleted' 
});
            await queue.enqueue(TRAJECTORY_GLB_QUEUE_NAME, {
 jobId: 'glb-1', trajectoryId: 'trajectory-deleted' 
});
            await queue.enqueue(TRAJECTORY_GLB_QUEUE_NAME, {
 jobId: 'glb-2', trajectoryId: 'trajectory-kept' 
});
            await waitFor(() => started.includes('raster-1'));

            const result = await getRuntimeStateCleanupControl().cleanupTrajectoryRuntimeState({
                trajectoryId: 'trajectory-deleted'
            });

            assert.equal(result.cancelledJobs, 1);
            assert.equal(result.unsettledJobs, 0);
            assert.equal(result.removedJobs, 3);
            assert.equal(await countJobsOf('trajectory-deleted'), 0);
            assert.equal(await countJobsOf('trajectory-kept'), 1);
            assert.ok(refusedWrite, 'the cancelled job could still write');
            assert.equal(
                fs.existsSync(path.join(objectStoreRoot, 'rasterizer', 'trajectory-trajectory-deleted', 'previews', 'late.png')),
                false
            );

            assert.equal(
                await queue.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, {
 jobId: 'raster-3', trajectoryId: 'trajectory-deleted' 
}),
                false
            );
            await queue.enqueueBulk(TRAJECTORY_RASTER_QUEUE_NAME, [
                {
 jobId: 'raster-4', trajectoryId: 'trajectory-deleted' 
},
                {
 jobId: 'raster-5', trajectoryId: 'trajectory-kept' 
}
            ]);
            assert.equal(await countJobsOf('trajectory-deleted'), 0);

            await waitFor(() => started.includes('raster-5'));
            assert.deepEqual(started, ['raster-1', 'raster-5']);

            await assert.rejects(getFilesystemObjectStore().putObject({
                bucket: 'plugins',
                objectKey: 'plugins/trajectory-trajectory-deleted/analysis-1/output.json',
                body: Buffer.from('{}')
            }), 'a write outside any job landed in the deleted trajectory');
        } finally {
            await worker.close();
        }
    });
});

describe('job reports', () => {
    test('drops the reports about a purged trajectory and sends the rest', async () => {
        getJobCancellationRegistry().cancelTrajectory('trajectory-purged');
        const reporter = getDaemonJobReporter();

        const published = await publishedJobIds(async () => {
            await reporter.reportRasterStarted({
 jobId: 'raster-purged', teamId: 'team', trajectoryId: 'trajectory-purged' 
});
            await reporter.reportRasterStarted({
 jobId: 'raster-live', teamId: 'team', trajectoryId: 'trajectory-live' 
});
        });

        assert.deepEqual(published, ['raster-live']);
    });

    test('drops the reports of a job cancelled by id, through its async context', async () => {
        const registry = getJobCancellationRegistry();
        const reporter = getDaemonJobReporter();

        const published = await publishedJobIds(async () => {
            await assert.rejects(registry.run({
 queue: 'queue', jobKey: 'job-cancelled', trajectoryId: 'trajectory-k' 
}, async () => {
                registry.cancelJob('job-cancelled');
                await wait(1);
                await reporter.reportRasterStarted({
 jobId: 'job-cancelled', teamId: 'team', trajectoryId: 'trajectory-k' 
});
                throwIfJobCancelled();
            }));
        });

        assert.deepEqual(published, []);
    });
});

describe('jobs.remove-running', () => {
    test('finds the pipeline job of a stage id, with or without an async context', async () => {
        const registry = getJobCancellationRegistry();
        let refused: unknown = null;

        await assert.rejects(registry.run({
 queue: 'queue', jobKey: 'pipeline-c-t-1-run', trajectoryId: 'trajectory-s' 
}, async () => {
            await wait(1);
            registry.cancelJob('pipeline-c-t-1-run');
            try {
                throwIfJobCancelled('pipeline-c-t-1-run:analysis-1');
            } catch (error) {
                refused = error;
                throw error;
            }
        }));

        assert.ok(refused);
    });

    test('cancels a pipeline job only once its last analysis stage is removed', async () => {
        const pipelineJobId = 'pipeline-cluster-trajectory-p-10-run';
        await getQueueService().enqueue(PIPELINE_QUEUE_NAME, {
            jobId: pipelineJobId,
            trajectoryId: 'trajectory-p',
            stages: [
                {
 kind: 'plugin', analysisId: 'analysis-1' 
},
                { kind: 'slice' },
                {
 kind: 'plugin', analysisId: 'analysis-2' 
},
                {
 kind: 'plugin', analysisId: 'analysis-cached', cacheHit: true 
}
            ]
        });

        const first = await getJobControl().removeRunningJobs({ jobIds: [`${pipelineJobId}:analysis-1`] });
        assert.deepEqual(first.affectedJobIds, [`${pipelineJobId}:analysis-1`]);
        assert.ok(await getQueueJobStore().findLiveJob(PIPELINE_QUEUE_NAME, pipelineJobId), 'analysis-2 still needs it');

        const cached = await getJobControl().removeRunningJobs({ jobIds: [`${pipelineJobId}:analysis-cached`] });
        assert.equal(cached.affectedJobs, 0, 'a cache-hit stage is no job of its own');

        const second = await getJobControl().removeRunningJobs({ jobIds: [`${pipelineJobId}:analysis-2`] });
        assert.deepEqual(second.affectedJobIds, [`${pipelineJobId}:analysis-2`]);
        assert.equal(await getQueueJobStore().findLiveJob(PIPELINE_QUEUE_NAME, pipelineJobId), null);
    });
});
