import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '@core/bootstrap/connect-database';
import teamJobProjectionService from '@modules/jobs/services/TeamJobProjectionService';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { generateEntityId } from '@shared/persistence/entity-id';
import type { JobProgressChangedEventPayload } from '@shared/events/JobProgressChangedPayload';

const ANALYSIS_QUEUE = 'analysis_processing';

type JobIdentity = Omit<JobProgressChangedEventPayload, 'progress' | 'progressText'>;

const startJob = async (status: JobStatus = JobStatus.Running): Promise<JobIdentity> => {
    const job: JobIdentity = {
        jobId: `pipeline-${generateEntityId()}:analysis-1`,
        teamId: `team-${generateEntityId()}`,
        teamClusterId: 'cluster-1',
        analysisId: 'analysis-1'
    };
    await teamJobProjectionService.upsertFromStatusChangedEvent({
        ...job,
        status,
        queueType: ANALYSIS_QUEUE,
        trajectoryId: 'trajectory-1',
        timestep: 400
    });
    return job;
};

const setStatus = (job: JobIdentity, status: JobStatus) => teamJobProjectionService.upsertFromStatusChangedEvent({
    ...job,
    status,
    queueType: ANALYSIS_QUEUE
});

const report = (job: JobIdentity, progress?: number, progressText?: string) => teamJobProjectionService.mergeProgress({
    ...job,
    ...(progress !== undefined ? { progress } : {}),
    ...(progressText !== undefined ? { progressText } : {})
});

describe('TeamJobProjectionService progress', () => {
    before(async () => {
        if (process.env.DATABASE_URL?.startsWith('sqlite:') !== true) {
            throw new Error('Run these tests with DATABASE_URL=sqlite::memory: (pnpm test does).');
        }
        await connectDatabase();
    });

    after(async () => {
        await disconnectDatabase();
    });

    test('puts a running job\'s progress on its snapshot, under a new revision', async () => {
        const job = await startJob();
        const statusOnly = await report(job, undefined, 'Meshing');
        const snapshot = await report(job, 0.4, 'Meshing');

        assert.equal(statusOnly?.progress, undefined);
        assert.equal(statusOnly?.progressText, 'Meshing');
        assert.equal(snapshot?.status, JobStatus.Running);
        assert.equal(snapshot?.progress, 0.4);
        assert.equal(snapshot?.progressText, 'Meshing');
        assert.equal(snapshot?.timestep, 400);
        assert.ok((snapshot?.revision ?? 0) > (statusOnly?.revision ?? Infinity));
    });

    test('leaves a job alone when the report repeats what it already shows', async () => {
        const job = await startJob();
        await report(job, 0.4);

        assert.equal(await report(job, 0.4), null);
    });

    test('ignores progress for a job that is not running, or that it never saw', async () => {
        const queued = await startJob(JobStatus.Queued);
        assert.equal(await report(queued, 0.4), null);

        const unknown: JobIdentity = {
            jobId: 'never-seen',
            teamId: 'team-x',
            teamClusterId: 'cluster-1',
            analysisId: 'analysis-1'
        };
        assert.equal(await report(unknown, 0.4), null);
    });

    test('ignores progress reported for another team, cluster or analysis', async () => {
        const job = await startJob();

        for (const mismatch of [{ teamId: 'other-team' }, { teamClusterId: 'other-cluster' }, { analysisId: 'other-analysis' }]) {
            assert.equal(await report({
                ...job,
                ...mismatch
            }, 0.4), null);
        }
    });

    test('drops the progress once the job leaves running, and takes none after it ends', async () => {
        const job = await startJob();
        await report(job, 0.9, 'Writing');

        const completed = await setStatus(job, JobStatus.Completed);
        assert.equal(completed?.progress, undefined);
        assert.equal(completed?.progressText, undefined);
        assert.equal(await report(job, 1), null);
    });

    test('a retried job starts without the progress of the run before', async () => {
        const job = await startJob();
        await report(job, 0.6);

        await setStatus(job, JobStatus.Retrying);
        const running = await setStatus(job, JobStatus.Running);

        assert.equal(running?.status, JobStatus.Running);
        assert.equal(running?.progress, undefined);
    });
});
