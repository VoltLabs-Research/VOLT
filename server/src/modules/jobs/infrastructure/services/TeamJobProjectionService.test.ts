import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import TeamJobProjectionService from './TeamJobProjectionService';

import type { JobStatusChangedEventPayload } from '@modules/jobs/domain/events/JobStatusChangedEvent';

class FakeRedisPipeline {
    constructor(
        private readonly store: Map<string, string>,
        private readonly sets: Map<string, Set<string>>
    ) {}

    set(key: string, value: string): this {
        this.store.set(key, value);
        return this;
    }

    sadd(key: string, value: string): this {
        const set = this.sets.get(key) ?? new Set<string>();
        set.add(value);
        this.sets.set(key, set);
        return this;
    }

    expire(): this {
        return this;
    }

    async exec(): Promise<Array<[null, string | number]>> {
        return [];
    }
}

class FakeRedis {
    private readonly store = new Map<string, string>();
    private readonly sets = new Map<string, Set<string>>();

    async get(key: string): Promise<string | null> {
        return this.store.get(key) ?? null;
    }

    pipeline(): FakeRedisPipeline {
        return new FakeRedisPipeline(this.store, this.sets);
    }

    async incr(key: string): Promise<number> {
        const currentValue = Number(this.store.get(key) ?? '0');
        const nextValue = (Number.isFinite(currentValue) ? currentValue : 0) + 1;
        this.store.set(key, String(nextValue));
        return nextValue;
    }

    async eval(
        _script: string,
        _keyCount: number,
        jobStatusKey: string,
        projectedTeamJobsKey: string,
        projectedAnalysisJobsKey: string,
        revisionKey: string,
        expectedSnapshot: string,
        nextSnapshotRaw: string,
        _ttlSeconds: number,
        linkAnalysis: string
    ): Promise<[number, string]> {
        const currentSnapshot = this.store.get(jobStatusKey) ?? null;

        if (expectedSnapshot === '__missing__') {
            if (currentSnapshot) {
                return [0, currentSnapshot];
            }
        } else if (currentSnapshot !== expectedSnapshot) {
            return [0, currentSnapshot ?? ''];
        }

        const revision = await this.incr(revisionKey);
        const snapshot = JSON.parse(nextSnapshotRaw) as Record<string, unknown>;
        snapshot.revision = revision;
        const snapshotJson = JSON.stringify(snapshot);

        this.store.set(jobStatusKey, snapshotJson);

        const projectedTeamJobs = this.sets.get(projectedTeamJobsKey) ?? new Set<string>();
        projectedTeamJobs.add(String(snapshot.jobId));
        this.sets.set(projectedTeamJobsKey, projectedTeamJobs);

        if (linkAnalysis === '1') {
            const projectedAnalysisJobs = this.sets.get(projectedAnalysisJobsKey) ?? new Set<string>();
            projectedAnalysisJobs.add(String(snapshot.jobId));
            this.sets.set(projectedAnalysisJobsKey, projectedAnalysisJobs);
        }

        return [1, snapshotJson];
    }
}

const createEvent = (
    status: JobStatusChangedEventPayload['status'],
    overrides: Partial<JobStatusChangedEventPayload> = {}
): JobStatusChangedEventPayload => ({
    jobId: 'job-1',
    teamId: 'team-1',
    status,
    queueType: 'analysis_processing',
    metadata: {
        jobId: 'job-1',
        status,
        queueType: 'analysis_processing',
        analysisId: 'analysis-1',
        name: 'Job 1'
    },
    ...overrides
});

test('TeamJobProjectionService keeps running when a late queued event arrives', async () => {
    const redis = new FakeRedis();
    const service = new TeamJobProjectionService(redis as never);

    await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Queued));
    await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Running));
    const snapshot = await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Queued));

    assert.equal(snapshot.status, JobStatus.Running);
    assert.equal(snapshot.metadata?.status, JobStatus.Running);
});

test('TeamJobProjectionService keeps terminal status when a late running event arrives', async () => {
    const redis = new FakeRedis();
    const service = new TeamJobProjectionService(redis as never);

    await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Running));
    await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Completed));
    const snapshot = await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Running));

    assert.equal(snapshot.status, JobStatus.Completed);
    assert.equal(snapshot.metadata?.status, JobStatus.Completed);
});

test('TeamJobProjectionService still allows forward progress to terminal states', async () => {
    const redis = new FakeRedis();
    const service = new TeamJobProjectionService(redis as never);

    await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Queued));
    await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Running));
    const snapshot = await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Failed));

    assert.equal(snapshot.status, JobStatus.Failed);
    assert.equal(snapshot.metadata?.status, JobStatus.Failed);
});

test('TeamJobProjectionService reopens a terminal job when a retrying event arrives', async () => {
    const redis = new FakeRedis();
    const service = new TeamJobProjectionService(redis as never);

    await service.upsertFromStatusChangedEvent(createEvent(JobStatus.Failed));
    const snapshot = await service.upsertFromStatusChangedEvent(createEvent('retrying'));

    assert.equal(snapshot.status, 'retrying');
    assert.equal(snapshot.metadata?.status, 'retrying');
});
