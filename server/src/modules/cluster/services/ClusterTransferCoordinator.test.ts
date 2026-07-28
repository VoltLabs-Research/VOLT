import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Analysis from '@modules/analysis/models/Analysis';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Plugin from '@modules/plugin/models/Plugin';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { ClusterTransferCoordinator } from '@modules/cluster/services/ClusterTransferCoordinator';
import {
    ClusterTransferJobReason,
    ClusterTransferJobState,
    createClusterTransferJobProps
} from '@modules/cluster/contracts/domain/cluster-transfer-job';
import { StoragePlacementScopeType } from '@modules/cluster/contracts/domain/storage-placement';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface Fixture{
    team: Team;
    owner: User;
    source: TeamCluster;
    destination: TeamCluster;
    trajectory: Trajectory;
}

interface CoordinatorInternals{
    claimNextRunnable(): Promise<{ id: string } | null>;
    renewClaim(jobId: string, claimTtlMs: number): Promise<boolean>;
    releaseClaim(jobId: string): Promise<void>;
    findOpenTransferJobByScope(scopeType: string, scopeId: string): Promise<{ id: string } | null>;
    setJobState(jobId: string, state: string, data?: Record<string, unknown>): Promise<{ id: string; props: Record<string, unknown> }>;
}

describe('ClusterTransferCoordinator', () => {
    let dataSource: DataSource;
    const coordinator = new ClusterTransferCoordinator();
    const internals = coordinator as unknown as CoordinatorInternals;

    before(async () => {
        dataSource = await createHarness([
            ClusterTransferJob,
            StoragePlacement,
            TeamCluster,
            Trajectory,
            Analysis,
            SceneArtifact,
            Plugin,
            CatalogFolder,
            Team,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createCluster = async (team: Team, owner: User, name: string, status: TeamClusterStatus): Promise<TeamCluster> => {
        return TeamCluster.create({
            name,
            team: team.id,
            createdBy: owner.id,
            status,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {
                desiredRole: 'cluster',
                effectiveRole: 'cluster',
                runtimeVersion: 1,
                draining: {
                    compute: false,
                    storage: false
                },
                lastAppliedAt: null
            }
        }).save();
    };

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const source = await createCluster(team, owner, 'source', TeamClusterStatus.Connected);
        const destination = await createCluster(team, owner, 'destination', TeamClusterStatus.Connected);
        const trajectory = await Trajectory.create({
            name: 'traj',
            team: team.id,
            createdBy: owner.id,
            storageClusterId: source.id,
            folder: null,
            stats: {
                totalFiles: 0,
                totalSize: 0
            }
        }).save();

        return {
            team,
            owner,
            source,
            destination,
            trajectory
        };
    };

    const createJob = async (
        fixture: Fixture,
        overrides: Partial<ClusterTransferJob> = {}
    ): Promise<ClusterTransferJob> => {
        const props = createClusterTransferJobProps({
            team: fixture.team.id,
            scopeType: 'trajectory',
            scopeId: fixture.trajectory.id,
            sourceClusterId: fixture.source.id,
            destinationClusterId: fixture.destination.id,
            buckets: [],
            requestedBy: fixture.owner.id
        });

        return ClusterTransferJob.create({
            team: props.team,
            scopeType: StoragePlacementScopeType.Trajectory,
            scopeId: props.scopeId,
            sourceClusterId: props.sourceClusterId,
            destinationClusterId: props.destinationClusterId,
            buckets: props.buckets,
            state: ClusterTransferJobState.Queued,
            reason: ClusterTransferJobReason.Manual,
            cleanupSource: props.cleanupSource,
            requestedBy: props.requestedBy,
            cursor: props.cursor,
            stats: props.stats,
            ...overrides
        }).save();
    };

    it('claims a queued job and stamps the lease', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture);

        const claimed = await internals.claimNextRunnable();

        assert.equal(claimed?.id, job.id);

        const reloaded = await ClusterTransferJob.findOneBy({ id: job.id });
        assert.ok(reloaded?.claimedBy);
        assert.ok(reloaded?.claimExpiresAt instanceof Date);
        assert.ok(reloaded!.claimExpiresAt!.getTime() > Date.now());
    });

    it('never hands the same job to a second claimer while the lease is live', async () => {
        const fixture = await createFixture();
        await createJob(fixture);

        const first = await internals.claimNextRunnable();
        const second = await internals.claimNextRunnable();

        assert.ok(first);
        assert.equal(second, null);
    });

    it('reclaims a job whose lease has expired', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture, {
            claimedBy: 'dead-worker',
            claimExpiresAt: new Date(Date.now() - 60_000)
        } as Partial<ClusterTransferJob>);

        const claimed = await internals.claimNextRunnable();

        assert.equal(claimed?.id, job.id);
        assert.notEqual((await ClusterTransferJob.findOneBy({ id: job.id }))?.claimedBy, 'dead-worker');
    });

    it('reclaims a job that was claimed without an expiry', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture, { claimedBy: 'dead-worker' } as Partial<ClusterTransferJob>);

        const claimed = await internals.claimNextRunnable();

        assert.equal(claimed?.id, job.id);
    });

    it('does not claim terminal jobs', async () => {
        const fixture = await createFixture();
        await createJob(fixture, { state: ClusterTransferJobState.Completed });
        await createJob(fixture, { state: ClusterTransferJobState.Failed });

        assert.equal(await internals.claimNextRunnable(), null);
    });

    it('releases a claim so the job becomes claimable again', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture);

        await internals.claimNextRunnable();
        await internals.releaseClaim(job.id);

        const released = await ClusterTransferJob.findOneBy({ id: job.id });
        assert.equal(released?.claimedBy, null);
        assert.equal(released?.claimExpiresAt, null);
        assert.equal((await internals.claimNextRunnable())?.id, job.id);
    });

    it('renews only a claim held by this worker', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture);

        assert.equal(await internals.renewClaim(job.id, 60_000), false);

        await internals.claimNextRunnable();
        const before = (await ClusterTransferJob.findOneBy({ id: job.id }))!.claimExpiresAt!;
        assert.equal(await internals.renewClaim(job.id, 10 * 60_000), true);
        const renewed = (await ClusterTransferJob.findOneBy({ id: job.id }))!.claimExpiresAt!;

        assert.ok(renewed.getTime() > before.getTime());
    });

    it('claims jobs oldest first', async () => {
        const fixture = await createFixture();
        const older = await createJob(fixture);
        await ClusterTransferJob.getRepository().query(
            'UPDATE cluster_transfer_jobs SET "createdAt" = ?, "updatedAt" = ? WHERE id = ?',
            ['2024-01-01 00:00:00.000', '2024-01-01 00:00:00.000', older.id]
        );
        const newer = await createJob(fixture, { scopeId: `${fixture.trajectory.id}-other` });
        await ClusterTransferJob.getRepository().query(
            'UPDATE cluster_transfer_jobs SET "createdAt" = ?, "updatedAt" = ? WHERE id = ?',
            ['2024-06-01 00:00:00.000', '2024-06-01 00:00:00.000', newer.id]
        );

        assert.equal((await internals.claimNextRunnable())?.id, older.id);
        assert.equal((await internals.claimNextRunnable())?.id, newer.id);
    });

    it('finds the newest open job for a scope and ignores terminal ones', async () => {
        const fixture = await createFixture();
        await createJob(fixture, { state: ClusterTransferJobState.Completed });
        const open = await createJob(fixture, { state: ClusterTransferJobState.Copying });

        const found = await internals.findOpenTransferJobByScope('trajectory', fixture.trajectory.id);

        assert.equal(found?.id, open.id);
    });

    it('returns null when no open job exists for a scope', async () => {
        const fixture = await createFixture();
        await createJob(fixture, { state: ClusterTransferJobState.Cancelled });

        assert.equal(await internals.findOpenTransferJobByScope('trajectory', fixture.trajectory.id), null);
    });

    it('persists a job state transition together with the supplied patch', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture);
        const startedAt = new Date('2024-03-01T00:00:00.000Z');

        const updated = await internals.setJobState(job.id, 'copying', {
            startedAt,
            stats: {
                copiedObjects: 3,
                copiedBytes: 128,
                verifiedObjects: 0,
                verifiedBytes: 0,
                deletedObjects: 0
            }
        });

        assert.equal(updated.props.state, 'copying');
        const reloaded = await ClusterTransferJob.findOneBy({ id: job.id });
        assert.equal(reloaded?.state, ClusterTransferJobState.Copying);
        assert.equal(reloaded?.startedAt?.getTime(), startedAt.getTime());
        assert.equal(reloaded?.stats.copiedObjects, 3);
    });

    it('rejects a state transition on a job that no longer exists', async () => {
        await createFixture();

        await assert.rejects(
            () => internals.setJobState('missing-job', 'copying'),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'ClusterTransferJob::NotFound');
                return true;
            }
        );
    });

    it('rejects executing a job that does not exist', async () => {
        await createFixture();

        await assert.rejects(
            () => coordinator.executeJob('missing-job'),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'ClusterTransferJob::NotFound');
                return true;
            }
        );
    });

    it('returns a terminal job unchanged instead of executing it', async () => {
        const fixture = await createFixture();
        const job = await createJob(fixture, { state: ClusterTransferJobState.Completed });

        const result = await coordinator.executeJob(job.id);

        assert.equal(result.id, job.id);
        assert.equal(result.props.state, ClusterTransferJobState.Completed);
    });

    it('runs no jobs when the queue is empty', async () => {
        await createFixture();

        assert.equal(await coordinator.runPendingJobs(3), 0);
    });
});
