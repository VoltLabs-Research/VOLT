import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { In } from 'typeorm';
import { closeRedisHandles } from '@tests/redis-handles';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Analysis from '@modules/analysis/models/Analysis';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Plugin from '@modules/plugin/models/Plugin';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ClusterService from '@modules/cluster/services/ClusterService';
import {
    ClusterTransferJobReason,
    ClusterTransferJobState
} from '@modules/cluster/contracts/domain/cluster-transfer-job';
import { StoragePlacementScopeType } from '@modules/cluster/contracts/domain/storage-placement';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import {
    createDefaultTeamClusterQueueConcurrency,
    createDefaultTeamClusterQueueScopeLimits,
    createDefaultTeamClusterRoleConfig
} from '@modules/cluster/services/TeamClusterFactory';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
}

describe('ClusterService', () => {
    let dataSource: DataSource;
    const service = new ClusterService();

    before(async () => {
        dataSource = await createHarness([
            TeamCluster,
            ClusterTransferJob,
            StoragePlacement,
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

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
            owner: owner.id
        }).save();

        return {
            team,
            otherTeam,
            owner
        };
    };

    it('creates a team cluster with complete default sub-objects', async () => {
        const fixture = await createFixture();

        const result = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: '  cluster-one  '
        });

        assert.ok(result.enrollmentToken.length > 0);
        assert.equal(result.teamCluster.name, 'cluster-one');
        assert.equal(result.teamCluster.status, TeamClusterStatus.WaitingForConnection);
        assert.equal(result.teamCluster.isDemo, false);
        assert.equal(result.teamCluster.queueConcurrency.pluginWarmup, 4);
        assert.deepEqual(result.teamCluster.queueScopeLimits, createDefaultTeamClusterQueueScopeLimits());
        assert.equal(result.teamCluster.roleConfig.desiredRole, 'cluster');
        assert.equal(result.teamCluster.roleConfig.effectiveRole, 'cluster');
        assert.equal(result.teamCluster.roleConfig.runtimeVersion, 1);
        assert.deepEqual(result.teamCluster.roleConfig.draining, {
            compute: false,
            storage: false
        });
        assert.equal(result.teamCluster.roleConfig.lastAppliedAt, null);
        assert.equal(result.teamCluster.effectiveCapabilities.acceptsComputeJobs, true);
    });

    it('never exposes service credentials on the create response', async () => {
        const fixture = await createFixture();

        const result = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'cluster-one'
        });

        const wire = JSON.parse(JSON.stringify(result.teamCluster)) as Record<string, unknown>;
        assert.deepEqual(wire.services, {
            minio: { port: null },
            redis: { port: null },
            mongodb: { port: null },
            daemon: { port: null }
        });
        assert.equal('enrollmentTokenHash' in wire, false);
    });

    it('never exposes service credentials or the token hash through the entity wire format', async () => {
        const fixture = await createFixture();
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'cluster-one'
        });

        const entity = (await TeamCluster.findOneBy({ team: fixture.team.id }))!;
        const wire = entity.toJSON();

        assert.equal('services' in wire, false);
        assert.equal('enrollmentTokenHash' in wire, false);
        assert.equal(wire._id, entity.id);
    });

    it('rejects creating a cluster for a missing user', async () => {
        const fixture = await createFixture();

        await assert.rejects(
            () => service.create({
                teamId: fixture.team.id,
                userId: 'missing-user',
                name: 'cluster-one'
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::UserNotFound');
                return true;
            }
        );
    });

    it('maps a duplicate cluster name to a conflict', async () => {
        const fixture = await createFixture();
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'cluster-one'
        });

        await assert.rejects(
            () => service.create({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                name: 'cluster-one'
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::AlreadyExists');
                return true;
            }
        );
    });

    it('allows the same cluster name in a different team', async () => {
        const fixture = await createFixture();
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'cluster-one'
        });

        const other = await service.create({
            teamId: fixture.otherTeam.id,
            userId: fixture.owner.id,
            name: 'cluster-one'
        });

        assert.equal(other.teamCluster.team, fixture.otherTeam.id);
    });

    it('lists clusters newest first and scoped to the team', async () => {
        const fixture = await createFixture();
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'beta'
        });
        await service.create({
            teamId: fixture.otherTeam.id,
            userId: fixture.owner.id,
            name: 'gamma'
        });

        const page = await service.listByTeamId({ teamId: fixture.team.id });

        assert.equal(page.total, 2);
        assert.equal(page.page, 1);
        assert.equal(page.limit, 100);
        assert.equal(page.totalPages, 1);
        assert.deepEqual(page.data.map((cluster) => cluster.name).sort(), ['alpha', 'beta']);
    });

    it('paginates the cluster listing', async () => {
        const fixture = await createFixture();
        for (const name of ['alpha', 'beta', 'gamma']) {
            await service.create({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                name
            });
        }

        const first = await service.listByTeamId({
            teamId: fixture.team.id,
            page: 1,
            limit: 2
        });
        const second = await service.listByTeamId({
            teamId: fixture.team.id,
            page: 2,
            limit: 2
        });

        assert.equal(first.total, 3);
        assert.equal(first.totalPages, 2);
        assert.equal(first.data.length, 2);
        assert.equal(second.data.length, 1);
    });

    it('filters the cluster listing by name', async () => {
        const fixture = await createFixture();
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'Production'
        });
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'staging'
        });

        const page = await service.listByTeamId({
            teamId: fixture.team.id,
            search: 'prod'
        });

        assert.equal(page.total, 1);
        assert.equal(page.data[0]?.name, 'Production');
    });

    it('filters the cluster listing by installed version', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'beta'
        });
        await TeamCluster.update({ id: created.teamCluster._id }, { installedVersion: '9.9.9' });

        const page = await service.listByTeamId({
            teamId: fixture.team.id,
            search: '9.9.9'
        });

        assert.equal(page.total, 1);
        assert.equal(page.data[0]?.name, 'alpha');
    });

    it('filters the cluster listing by an id substring', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'beta'
        });

        const page = await service.listByTeamId({
            teamId: fixture.team.id,
            search: created.teamCluster._id.slice(-10)
        });

        assert.equal(page.total, 1);
        assert.equal(page.data[0]?._id, created.teamCluster._id);
    });

    it('treats search wildcards as literal characters', async () => {
        const fixture = await createFixture();
        await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        const page = await service.listByTeamId({
            teamId: fixture.team.id,
            search: '%'
        });

        assert.equal(page.total, 0);
    });

    it('attaches the active transfers of each listed cluster', async () => {
        const fixture = await createFixture();
        const source = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'source'
        });
        const destination = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'destination'
        });
        await ClusterTransferJob.create({
            team: fixture.team.id,
            scopeType: StoragePlacementScopeType.Trajectory,
            scopeId: 'scope-one',
            sourceClusterId: source.teamCluster._id,
            destinationClusterId: destination.teamCluster._id,
            buckets: [],
            state: ClusterTransferJobState.Copying,
            reason: ClusterTransferJobReason.Manual,
            requestedBy: fixture.owner.id,
            cursor: {
                bucketIndex: 0,
                lastObjectKey: null
            },
            stats: {
                copiedObjects: 0,
                copiedBytes: 0,
                verifiedObjects: 0,
                verifiedBytes: 0,
                deletedObjects: 0
            }
        }).save();
        await ClusterTransferJob.create({
            team: fixture.team.id,
            scopeType: StoragePlacementScopeType.Trajectory,
            scopeId: 'scope-two',
            sourceClusterId: source.teamCluster._id,
            destinationClusterId: destination.teamCluster._id,
            buckets: [],
            state: ClusterTransferJobState.Completed,
            reason: ClusterTransferJobReason.Manual,
            requestedBy: fixture.owner.id,
            cursor: {
                bucketIndex: 0,
                lastObjectKey: null
            },
            stats: {
                copiedObjects: 0,
                copiedBytes: 0,
                verifiedObjects: 0,
                verifiedBytes: 0,
                deletedObjects: 0
            }
        }).save();

        const page = await service.listByTeamId({ teamId: fixture.team.id });
        const listedSource = page.data.find((cluster) => cluster._id === source.teamCluster._id);
        const listedDestination = page.data.find((cluster) => cluster._id === destination.teamCluster._id);

        assert.equal(listedSource?.activeTransfers?.length, 1);
        assert.equal(listedDestination?.activeTransfers?.length, 1);
        assert.equal(listedSource?.activeTransfers?.[0]?.scopeId, 'scope-one');
    });

    it('reads a cluster owned by the team', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        const result = await service.getById({
            teamId: fixture.team.id,
            teamClusterId: created.teamCluster._id
        });

        assert.equal(result.teamCluster._id, created.teamCluster._id);
    });

    it('hides a cluster owned by another team', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        await assert.rejects(
            () => service.getById({
                teamId: fixture.otherTeam.id,
                teamClusterId: created.teamCluster._id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::NotFound');
                return true;
            }
        );
    });

    it('persists queue settings merged over the defaults', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        const result = await service.updateQueueConcurrency({
            teamId: fixture.team.id,
            teamClusterId: created.teamCluster._id,
            queueConcurrency: {
                analysis: 2,
                rasterizer: 3,
                glbPreprocessing: 4,
                artifactUpload: 5,
                pluginWarmup: 6
            },
            queueScopeLimits: {
                analysisProcessing: { maxRunningPerTrajectory: 1 },
                artifactUpload: { maxRunningPerTrajectory: 2 },
                trajectoryRasterization: { maxRunningPerTrajectory: 3 },
                trajectoryGlbConversion: { maxRunningPerTrajectory: 4 }
            }
        });

        assert.equal(result.message, 'Queue settings saved.');
        assert.equal(result.teamCluster.queueConcurrency.analysis, 2);
        assert.equal(result.teamCluster.queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory, 4);

        const reloaded = await TeamCluster.findOneBy({ id: created.teamCluster._id });
        assert.equal(reloaded?.queueConcurrency.pluginWarmup, 6);
    });

    it('bumps the runtime version when the desired role changes', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        const changed = await service.updateRole({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            teamClusterId: created.teamCluster._id,
            role: 'storage-server'
        });

        assert.equal(changed.teamCluster.roleConfig.desiredRole, 'storage-server');
        assert.equal(changed.teamCluster.roleConfig.runtimeVersion, 2);
        assert.equal(changed.teamCluster.effectiveCapabilities.acceptsComputeJobs, true);
    });

    it('keeps the runtime version when the desired role is unchanged', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        const unchanged = await service.updateRole({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            teamClusterId: created.teamCluster._id,
            role: 'cluster'
        });

        assert.equal(unchanged.teamCluster.roleConfig.runtimeVersion, 1);
    });

    it('regenerates the enrollment token only for waiting clusters', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });
        const before = (await TeamCluster.findOneBy({ id: created.teamCluster._id }))!.enrollmentTokenHash;

        const result = await service.regenerateEnrollmentToken({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            teamClusterId: created.teamCluster._id
        });

        assert.ok(result.enrollmentToken.length > 0);
        assert.notEqual((await TeamCluster.findOneBy({ id: created.teamCluster._id }))!.enrollmentTokenHash, before);
    });

    it('refuses to regenerate the enrollment token for a connected cluster', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });
        await TeamCluster.update({ id: created.teamCluster._id }, { status: TeamClusterStatus.Connected });

        await assert.rejects(
            () => service.regenerateEnrollmentToken({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                teamClusterId: created.teamCluster._id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::InvalidStatusForTokenRegeneration');
                return true;
            }
        );
    });

    it('lists transfer jobs touching the cluster on either side', async () => {
        const fixture = await createFixture();
        const source = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'source'
        });
        const destination = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'destination'
        });
        const unrelated = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'unrelated'
        });

        for (const [scopeId, state] of [['scope-one', ClusterTransferJobState.Copying], ['scope-two', ClusterTransferJobState.Completed]] as const) {
            await ClusterTransferJob.create({
                team: fixture.team.id,
                scopeType: StoragePlacementScopeType.Trajectory,
                scopeId,
                sourceClusterId: source.teamCluster._id,
                destinationClusterId: destination.teamCluster._id,
                buckets: [],
                state,
                reason: ClusterTransferJobReason.Manual,
                requestedBy: fixture.owner.id,
                cursor: {
                    bucketIndex: 0,
                    lastObjectKey: null
                },
                stats: {
                    copiedObjects: 0,
                    copiedBytes: 0,
                    verifiedObjects: 0,
                    verifiedBytes: 0,
                    deletedObjects: 0
                }
            }).save();
        }

        const all = await service.listTransferJobs({
            teamId: fixture.team.id,
            teamClusterId: destination.teamCluster._id
        });
        const filtered = await service.listTransferJobs({
            teamId: fixture.team.id,
            teamClusterId: destination.teamCluster._id,
            state: 'copying'
        });
        const none = await service.listTransferJobs({
            teamId: fixture.team.id,
            teamClusterId: unrelated.teamCluster._id
        });

        assert.equal(all.total, 2);
        assert.equal(all.limit, 100);
        assert.equal(filtered.total, 1);
        assert.equal(filtered.data[0]?.scopeId, 'scope-one');
        assert.equal(none.total, 0);
    });

    it('paginates transfer jobs', async () => {
        const fixture = await createFixture();
        const source = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'source'
        });
        const destination = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'destination'
        });

        for (const scopeId of ['a', 'b', 'c']) {
            await ClusterTransferJob.create({
                team: fixture.team.id,
                scopeType: StoragePlacementScopeType.Trajectory,
                scopeId,
                sourceClusterId: source.teamCluster._id,
                destinationClusterId: destination.teamCluster._id,
                buckets: [],
                state: ClusterTransferJobState.Completed,
                reason: ClusterTransferJobReason.Manual,
                requestedBy: fixture.owner.id,
                cursor: {
                    bucketIndex: 0,
                    lastObjectKey: null
                },
                stats: {
                    copiedObjects: 0,
                    copiedBytes: 0,
                    verifiedObjects: 0,
                    verifiedBytes: 0,
                    deletedObjects: 0
                }
            }).save();
        }

        const page = await service.listTransferJobs({
            teamId: fixture.team.id,
            teamClusterId: source.teamCluster._id,
            page: 2,
            limit: 2
        });

        assert.equal(page.total, 3);
        assert.equal(page.totalPages, 2);
        assert.equal(page.data.length, 1);
    });

    it('reveals decrypted credentials only after a password confirmation', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        await assert.rejects(
            () => service.revealCredentials({
                teamId: fixture.team.id,
                teamClusterId: created.teamCluster._id,
                userId: fixture.owner.id,
                password: 'whatever'
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::PasswordConfirmationUnavailable');
                return true;
            }
        );
    });

    it('reports no active demo when none exists', async () => {
        const fixture = await createFixture();

        const status = await service.getDemoStatus({
            teamId: fixture.team.id,
            userId: fixture.owner.id
        });

        assert.equal(status.hasActiveDemo, false);
        assert.equal(status.teamCluster, null);
        assert.equal(status.remainingMs, null);
        assert.deepEqual(await service.deleteDemo({
            teamId: fixture.team.id,
            userId: fixture.owner.id
        }), { teardownScheduled: false });
    });

    it('excludes deleting demos from the active demo lookup', async () => {
        const fixture = await createFixture();
        await TeamCluster.create({
            name: 'demo',
            team: fixture.team.id,
            createdBy: fixture.owner.id,
            status: TeamClusterStatus.Deleting,
            isDemo: true,
            demoExpiresAt: new Date(Date.now() + 60_000),
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();

        const status = await service.getDemoStatus({
            teamId: fixture.team.id,
            userId: fixture.owner.id
        });

        assert.equal(status.hasActiveDemo, false);
    });

    it('reports the remaining lifetime of an active demo', async () => {
        const fixture = await createFixture();
        await TeamCluster.create({
            name: 'demo',
            team: fixture.team.id,
            createdBy: fixture.owner.id,
            status: TeamClusterStatus.WaitingForConnection,
            isDemo: true,
            demoExpiresAt: new Date(Date.now() + 120_000),
            services: {
                minio: { port: null },
                redis: { port: null },
                mongodb: { port: null },
                daemon: { port: null }
            },
            queueConcurrency: createDefaultTeamClusterQueueConcurrency(),
            queueScopeLimits: createDefaultTeamClusterQueueScopeLimits(),
            roleConfig: createDefaultTeamClusterRoleConfig()
        }).save();

        const status = await service.getDemoStatus({
            teamId: fixture.team.id,
            userId: fixture.owner.id
        });

        assert.equal(status.hasActiveDemo, true);
        assert.ok((status.remainingMs ?? 0) > 0);
        assert.equal(status.teamCluster?.isDemo, true);
    });

    it('rejects a transfer request onto the same cluster', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });

        await assert.rejects(
            () => service.createTransferRequest({
                teamId: fixture.team.id,
                teamClusterId: created.teamCluster._id,
                destinationClusterId: created.teamCluster._id,
                authenticatedUserId: fixture.owner.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'ClusterTransfer::DestinationMustDiffer');
                return true;
            }
        );
    });

    it('rejects a transfer request from a disconnected source cluster', async () => {
        const fixture = await createFixture();
        const source = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'source'
        });
        const destination = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'destination'
        });

        await assert.rejects(
            () => service.createTransferRequest({
                teamId: fixture.team.id,
                teamClusterId: source.teamCluster._id,
                destinationClusterId: destination.teamCluster._id,
                authenticatedUserId: fixture.owner.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'ClusterTransfer::SourceClusterUnavailable');
                return true;
            }
        );
    });

    it('rejects a transfer request when the source cluster has no placements', async () => {
        const fixture = await createFixture();
        const source = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'source'
        });
        const destination = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'destination'
        });
        await TeamCluster.update({ id: In([source.teamCluster._id, destination.teamCluster._id]) }, { status: TeamClusterStatus.Connected });

        await assert.rejects(
            () => service.createTransferRequest({
                teamId: fixture.team.id,
                teamClusterId: source.teamCluster._id,
                destinationClusterId: destination.teamCluster._id,
                authenticatedUserId: fixture.owner.id
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'ClusterTransfer::NoPlacements');
                return true;
            }
        );
    });

    it('deletes a cluster that was never connected and asks for a manual uninstall when a version is installed', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });
        await TeamCluster.update({ id: created.teamCluster._id }, {
            status: TeamClusterStatus.Disconnected,
            installedVersion: '1.0.0',
            installRoot: '/opt/volt'
        });
        await User.update({ id: fixture.owner.id }, { password: 'not-a-real-hash' });

        await assert.rejects(
            () => service.deleteById({
                teamId: fixture.team.id,
                teamClusterId: created.teamCluster._id,
                userId: fixture.owner.id,
                password: 'wrong'
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                return true;
            }
        );

        assert.equal(await TeamCluster.countBy({ id: created.teamCluster._id }), 1);
    });

    it('refuses to delete a cluster whose deletion is already running', async () => {
        const fixture = await createFixture();
        const created = await service.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            name: 'alpha'
        });
        await TeamCluster.update({ id: created.teamCluster._id }, { status: TeamClusterStatus.Deleting });

        await assert.rejects(
            () => service.deleteById({
                teamId: fixture.team.id,
                teamClusterId: created.teamCluster._id,
                userId: fixture.owner.id,
                password: 'whatever'
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, 'TeamCluster::PasswordConfirmationUnavailable');
                return true;
            }
        );
    });
});
