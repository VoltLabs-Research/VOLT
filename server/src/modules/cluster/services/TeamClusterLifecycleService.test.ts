import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { TeamClusterLifecycleService } from '@modules/cluster/services/TeamClusterLifecycleService';
import { toTeamClusterLike } from '@modules/cluster/contracts/domain/team-cluster';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import TeamClusterCredentialService, { hashEnrollmentToken } from '@modules/cluster/services/TeamClusterCredentialService';
import {
    buildTeamClusterProps,
    createServiceCredentials,
    encryptTeamClusterServices
} from '@modules/cluster/services/TeamClusterFactory';
import ApplicationError from '@shared/application/errors/ApplicationError';

const ENROLLMENT_TOKEN = 'enrollment-token-value';
const DAEMON_PASSWORD = 'daemon-password-value';

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
}

describe('TeamClusterLifecycleService', () => {
    let dataSource: DataSource;
    const service = new TeamClusterLifecycleService();
    const credentialService = new TeamClusterCredentialService();

    before(async () => {
        dataSource = await createHarness([TeamCluster, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createFixture = async (status: TeamClusterStatus = TeamClusterStatus.WaitingForConnection): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const services = await encryptTeamClusterServices(credentialService, {
            minio: createServiceCredentials('minio'),
            redis: createServiceCredentials('redis'),
            mongodb: createServiceCredentials('mongodb'),
            daemon: { password: DAEMON_PASSWORD }
        });
        const props = buildTeamClusterProps({
            name: 'cluster-one',
            teamId: team.id,
            createdBy: owner.id,
            enrollmentTokenHash: hashEnrollmentToken(ENROLLMENT_TOKEN),
            services,
            isDemo: false,
            demoExpiresAt: null
        });
        const cluster = await TeamCluster.create({
            name: props.name,
            team: props.team,
            createdBy: props.createdBy,
            status,
            enrollmentTokenHash: props.enrollmentTokenHash,
            services: props.services,
            queueConcurrency: props.queueConcurrency,
            queueScopeLimits: props.queueScopeLimits,
            roleConfig: props.roleConfig
        }).save();

        return {
            team,
            owner,
            cluster
        };
    };

    it('processes a healthcheck, clears the enrollment token and returns the daemon password', async () => {
        const fixture = await createFixture();

        const result = await service.processHealthcheck(fixture.cluster.id, ENROLLMENT_TOKEN, '1.2.3');

        assert.equal(result.daemonPassword, DAEMON_PASSWORD);
        assert.equal(result.teamCluster.status, TeamClusterStatus.HealthcheckReceived);
        assert.equal(result.teamCluster.installedVersion, '1.2.3');

        const reloaded = await TeamCluster.findOneBy({ id: fixture.cluster.id });
        assert.equal(reloaded?.enrollmentTokenHash, null);
    });

    it('rejects a healthcheck with an invalid enrollment token', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => service.processHealthcheck(fixture.cluster.id, 'wrong-token'),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::EnrollmentInvalid');
                return true;
            }
        );
    });

    it('rejects a healthcheck once enrollment has completed', async () => {
        const fixture = await createFixture();
        await TeamCluster.update({ id: fixture.cluster.id }, { enrollmentTokenHash: null });

        await assert.rejects(
            () => service.processHealthcheck(fixture.cluster.id, ENROLLMENT_TOKEN),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::EnrollmentAlreadyCompleted');
                return true;
            }
        );
    });

    it('rejects daemon authentication with a wrong password', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => service.authenticateDaemonConnection(fixture.cluster.id, 'nope'),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::DaemonUnauthorized');
                return true;
            }
        );
    });

    it('rejects daemon authentication for an unknown cluster', async () => {
        await createFixture();

        await assert.rejects(
            () => service.authenticateDaemonConnection('missing-cluster', DAEMON_PASSWORD),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::NotFound');
                return true;
            }
        );
    });

    it('records a heartbeat and stamps lastHeartbeatAt', async () => {
        const fixture = await createFixture(TeamClusterStatus.Connected);

        const view = await service.recordHeartbeat(fixture.cluster.id, DAEMON_PASSWORD, '2.0.0');

        assert.equal(view.status, TeamClusterStatus.Connected);
        assert.equal(view.installedVersion, '2.0.0');
        assert.ok(view.lastHeartbeatAt instanceof Date);
    });

    it('applies the runtime role config reported by a heartbeat', async () => {
        const fixture = await createFixture(TeamClusterStatus.Connected);

        const view = await service.recordHeartbeat(fixture.cluster.id, DAEMON_PASSWORD, undefined, {
            roleConfig: {
                desiredRole: 'storage-server',
                effectiveRole: 'storage-server',
                runtimeVersion: 3,
                draining: {
                    compute: true,
                    storage: false
                },
                lastAppliedAt: null
            }
        });

        assert.equal(view.roleConfig.effectiveRole, 'storage-server');
        assert.equal(view.roleConfig.runtimeVersion, 3);
        assert.equal(view.roleConfig.draining.compute, true);
        assert.equal(view.effectiveCapabilities.acceptsComputeJobs, false);
    });

    it('updates the lifecycle status and records the disconnect timestamp', async () => {
        const fixture = await createFixture(TeamClusterStatus.Connected);

        const view = await service.updateLifecycleStatus(fixture.cluster.id, DAEMON_PASSWORD, TeamClusterStatus.Disconnected);

        assert.equal(view.status, TeamClusterStatus.Disconnected);
        assert.ok(view.lastDisconnectAt instanceof Date);
    });

    it('ignores an illegal lifecycle transition and leaves the row untouched', async () => {
        const fixture = await createFixture(TeamClusterStatus.WaitingForConnection);

        const view = await service.updateLifecycleStatus(fixture.cluster.id, DAEMON_PASSWORD, TeamClusterStatus.Updating);

        assert.equal(view.status, TeamClusterStatus.WaitingForConnection);
        assert.equal((await TeamCluster.findOneBy({ id: fixture.cluster.id }))?.status, TeamClusterStatus.WaitingForConnection);
    });

    it('marks a daemon connected and clears the disconnect timestamp', async () => {
        const fixture = await createFixture(TeamClusterStatus.WaitingForConnection);
        await TeamCluster.update({ id: fixture.cluster.id }, { lastDisconnectAt: new Date() });

        const view = await service.markDaemonConnected(fixture.cluster.id);

        assert.equal(view.status, TeamClusterStatus.Connected);
        assert.equal(view.lastDisconnectAt, null);
    });

    it('keeps a locked status when a daemon connects while deleting', async () => {
        const fixture = await createFixture(TeamClusterStatus.Deleting);

        const view = await service.markDaemonConnected(fixture.cluster.id);

        assert.equal(view.status, TeamClusterStatus.Deleting);
    });

    it('marks a connected daemon as disconnected', async () => {
        const fixture = await createFixture(TeamClusterStatus.Connected);

        const view = await service.markDaemonDisconnected(fixture.cluster.id);

        assert.equal(view.status, TeamClusterStatus.Disconnected);
        assert.ok(view.lastDisconnectAt instanceof Date);
    });

    it('marks a cluster as deleting', async () => {
        const fixture = await createFixture(TeamClusterStatus.Connected);

        const view = await service.markDeleting(fixture.cluster.id);

        assert.equal(view.status, TeamClusterStatus.Deleting);
    });

    it('completes deletion when the daemon confirms with valid credentials', async () => {
        const fixture = await createFixture(TeamClusterStatus.Deleting);

        await service.completeDeletion(fixture.cluster.id, DAEMON_PASSWORD);

        assert.equal(await TeamCluster.countBy({ id: fixture.cluster.id }), 0);
    });

    it('rejects deleting a cluster that no longer exists', async () => {
        const fixture = await createFixture();
        const teamCluster = toTeamClusterLike(fixture.cluster);
        await TeamCluster.delete({ id: fixture.cluster.id });

        await assert.rejects(
            () => service.deleteTeamCluster(teamCluster),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::NotFound');
                return true;
            }
        );
    });

    it('finalizes deleting clusters that disconnected before the cutoff', async () => {
        const fixture = await createFixture(TeamClusterStatus.Deleting);
        await TeamCluster.update({ id: fixture.cluster.id }, { lastDisconnectAt: new Date('2024-01-01T00:00:00.000Z') });

        const finalized = await service.finalizeDeletingClustersByEvidence(new Date('2024-01-02T00:00:00.000Z'));

        assert.equal(finalized, 1);
        assert.equal(await TeamCluster.count(), 0);
    });

    it('does not finalize deleting clusters that never disconnected', async () => {
        await createFixture(TeamClusterStatus.Deleting);

        const finalized = await service.finalizeDeletingClustersByEvidence(new Date());

        assert.equal(finalized, 0);
        assert.equal(await TeamCluster.count(), 1);
    });

    it('marks stale deleting clusters as delete-failed using the affected-row guard', async () => {
        const fixture = await createFixture(TeamClusterStatus.Deleting);

        const marked = await service.markDeletingTimeouts(new Date(Date.now() + 60_000));

        assert.equal(marked, 1);
        assert.equal((await TeamCluster.findOneBy({ id: fixture.cluster.id }))?.status, TeamClusterStatus.DeleteFailed);
    });

    it('does not mark deleting clusters updated after the cutoff', async () => {
        const fixture = await createFixture(TeamClusterStatus.Deleting);

        const marked = await service.markDeletingTimeouts(new Date(Date.now() - 60_000));

        assert.equal(marked, 0);
        assert.equal((await TeamCluster.findOneBy({ id: fixture.cluster.id }))?.status, TeamClusterStatus.Deleting);
    });

    it('ignores a stale lifecycle update whose precondition no longer holds', async () => {
        const fixture = await createFixture(TeamClusterStatus.Deleting);
        const marked = await service.markDeletingTimeouts(new Date(Date.now() + 60_000));
        assert.equal(marked, 1);

        const markedAgain = await service.markDeletingTimeouts(new Date(Date.now() + 60_000));

        assert.equal(markedAgain, 0);
        assert.equal((await TeamCluster.findOneBy({ id: fixture.cluster.id }))?.status, TeamClusterStatus.DeleteFailed);
    });
});
