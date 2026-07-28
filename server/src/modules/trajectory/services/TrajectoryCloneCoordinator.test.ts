import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import TrajectoryCloneJob from '@modules/trajectory/models/TrajectoryCloneJob';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { TrajectoryCloneCoordinator } from '@modules/trajectory/services/TrajectoryCloneCoordinator';
import { TrajectoryCloneJobState } from '@modules/trajectory/contracts/domain/trajectory-clone-job';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    source: Trajectory;
    destination: Trajectory;
}

describe('TrajectoryCloneCoordinator', () => {
    let dataSource: DataSource;
    const coordinator = new TrajectoryCloneCoordinator();

    before(async () => {
        dataSource = await createHarness([
            TrajectoryCloneJob,
            Trajectory,
            TrajectoryFrame,
            SimulationCell,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);
        (eventBus as unknown as { publish: () => Promise<void> }).publish = async () => {};
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: 'storage',
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const source = await Trajectory.create({
            name: 'source',
            team: team.id,
            storageClusterId: cluster.id,
            createdBy: owner.id
        }).save();
        const destination = await Trajectory.create({
            name: 'destination',
            team: team.id,
            storageClusterId: cluster.id,
            createdBy: owner.id,
            status: TrajectoryStatus.Processing
        }).save();

        return {
            team,
            owner,
            cluster,
            source,
            destination
        };
    };

    const createJob = (fixture: Fixture, overrides: Partial<TrajectoryCloneJob> = {}): Promise<TrajectoryCloneJob> => TrajectoryCloneJob.create({
        team: fixture.team.id,
        sourceTrajectoryId: fixture.source.id,
        destinationTrajectoryId: fixture.destination.id,
        sourceClusterId: fixture.cluster.id,
        destinationClusterId: fixture.cluster.id,
        requestedBy: fixture.owner.id,
        stats: {
            totalFrames: 0,
            copiedFrames: 0,
            copiedBytes: 0
        },
        ...overrides
    }).save();

    it('rejects an unknown job id', async () => {
        await assert.rejects(
            () => coordinator.executeJob('a'.repeat(24)),
            (error: unknown) => error instanceof ApplicationError && error.code === 'TrajectoryCloneJob::NotFound'
        );
    });

    it('leaves a job in a terminal state untouched', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture, { state: TrajectoryCloneJobState.Completed });

        const result = await coordinator.executeJob(job.id);

        assert.equal(result.state, TrajectoryCloneJobState.Completed);
        assert.equal(result.startedAt, null);
    });

    it('fails a job whose source trajectory is gone', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture);
        await fixture.source.remove();

        const result = await coordinator.executeJob(job.id);

        assert.equal(result.state, TrajectoryCloneJobState.Failed);
        assert.equal(result.errorCode, 'Trajectory::NotFound');
        assert.ok(result.finishedAt);

        const destination = await Trajectory.findOneBy({ id: fixture.destination.id });
        assert.equal(destination?.status, TrajectoryStatus.Failed);
    });

    it('completes a job whose source has no frames without contacting the daemon', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture);

        const result = await coordinator.executeJob(job.id);

        assert.equal(result.state, TrajectoryCloneJobState.Completed);
        assert.equal(result.stats.totalFrames, 0);
        assert.ok(result.startedAt);
        assert.ok(result.finishedAt);

        const destination = await Trajectory.findOneBy({ id: fixture.destination.id });
        assert.equal(destination?.status, TrajectoryStatus.Completed);
        assert.equal(destination?.hasPreview, false);
    });

    it('claims a runnable job, runs it and releases the lease', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture);

        const processed = await coordinator.runPendingJobs(1);

        assert.equal(processed, 1);

        const reloaded = await TrajectoryCloneJob.findOneBy({ id: job.id });
        assert.equal(reloaded?.state, TrajectoryCloneJobState.Completed);
        assert.equal(reloaded?.claimedBy, null);
        assert.equal(reloaded?.claimExpiresAt, null);
    });

    it('does not claim a job already leased by another worker', async () => {
        const fixture = await createFixture();
        await createJob(fixture, {
            claimedBy: 'other-worker',
            claimExpiresAt: new Date(Date.now() + 60_000)
        });

        const processed = await coordinator.runPendingJobs(1);

        assert.equal(processed, 0);
    });

    it('reclaims a job whose lease expired', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture, {
            claimedBy: 'dead-worker',
            claimExpiresAt: new Date(Date.now() - 60_000)
        });

        const processed = await coordinator.runPendingJobs(1);

        assert.equal(processed, 1);
        const reloaded = await TrajectoryCloneJob.findOneBy({ id: job.id });
        assert.equal(reloaded?.state, TrajectoryCloneJobState.Completed);
    });

    it('skips jobs that are no longer open', async () => {
        const fixture = await createFixture();
        await createJob(fixture, { state: TrajectoryCloneJobState.Failed });

        const processed = await coordinator.runPendingJobs(1);

        assert.equal(processed, 0);
    });

    it('stops after the requested job limit', async () => {
        const fixture = await createFixture();
        await createJob(fixture);
        await createJob(fixture);

        const processed = await coordinator.runPendingJobs(1);

        assert.equal(processed, 1);
        assert.equal(await TrajectoryCloneJob.countBy({ state: TrajectoryCloneJobState.Queued }), 1);
    });

    it('records the source frame total before requiring the storage clusters', async () => {
        const fixture = await createFixture();
        await TrajectoryFrame.create({
            trajectoryId: fixture.source.id,
            timestep: 20,
            natoms: 4
        }).save();
        await TrajectoryFrame.create({
            trajectoryId: fixture.source.id,
            timestep: 10,
            natoms: 4
        }).save();
        const job = await createJob(fixture, { sourceClusterId: null });

        const result = await coordinator.executeJob(job.id);

        assert.equal(result.state, TrajectoryCloneJobState.Failed);
        assert.equal(result.errorCode, 'TrajectoryClone::StorageClusterRequired');
        assert.equal(result.stats.totalFrames, 2);
        assert.equal(result.stats.copiedFrames, 0);
    });
});
