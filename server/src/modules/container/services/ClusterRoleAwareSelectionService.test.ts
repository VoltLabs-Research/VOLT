import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { ClusterRoleAwareSelectionService } from '@modules/container/services/ClusterRoleAwareSelectionService';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRedisRepository';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TeamClusterStatus } from '@shared/contracts/types';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import type { TeamClusterRole } from '@shared/contracts/types/TeamCluster';

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
}

interface ClusterOptions{
    role?: TeamClusterRole;
    status?: TeamClusterStatus;
    drainingCompute?: boolean;
    drainingStorage?: boolean;
    createdAt?: Date;
}

const ENTITIES = [TeamCluster, Team, User];

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

const metricsWith = (usage: { cpu?: number; memory?: number; disk?: number; network?: number }): SystemMetrics => ({
    cpu: { usage: usage.cpu ?? 0 },
    memory: { usagePercent: usage.memory ?? 0 },
    disk: { usagePercent: usage.disk ?? 0 },
    network: { total: usage.network ?? 0 }
} as unknown as SystemMetrics);

describe('ClusterRoleAwareSelectionService', () => {
    let dataSource: DataSource;
    const service = new ClusterRoleAwareSelectionService();
    const metricsByClusterId = new Map<string, SystemMetrics>();

    before(async () => {
        dataSource = await createHarness(ENTITIES);
        systemMetricsRepository.getLatestByClusterId = async (clusterId: string) => metricsByClusterId.get(clusterId) ?? null;
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        metricsByClusterId.clear();
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

    const seedCluster = async (
        fixture: Fixture,
        name: string,
        options: ClusterOptions = {}
    ): Promise<TeamCluster> => {
        const cluster = await TeamCluster.create({
            name,
            team: fixture.team.id,
            createdBy: fixture.owner.id,
            status: options.status ?? TeamClusterStatus.Connected,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {
                desiredRole: options.role ?? 'cluster',
                effectiveRole: options.role ?? 'cluster',
                runtimeVersion: 1,
                draining: {
                    compute: options.drainingCompute ?? false,
                    storage: options.drainingStorage ?? false
                }
            }
        }).save();

        if(options.createdAt){
            await TeamCluster.update({ id: cluster.id }, { createdAt: options.createdAt });
        }

        return cluster;
    };

    describe('resolveConnectedClusterId', () => {
        it('returns the only connected cluster of the team', async () => {
            const fixture = await createFixture();
            const cluster = await seedCluster(fixture, 'one');

            assert.equal(await service.resolveConnectedClusterId({ teamId: fixture.team.id }), cluster.id);
        });

        it('returns the explicitly requested cluster', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'one');
            const requested = await seedCluster(fixture, 'two');

            assert.equal(
                await service.resolveConnectedClusterId({
                    teamId: fixture.team.id,
                    requestedTeamClusterId: requested.id
                }),
                requested.id
            );
        });

        it('rejects a requested cluster that belongs to another team', async () => {
            const fixture = await createFixture();
            const cluster = await seedCluster(fixture, 'one');

            await assert.rejects(
                () => service.resolveConnectedClusterId({
                    teamId: fixture.otherTeam.id,
                    requestedTeamClusterId: cluster.id
                }),
                isApplicationError('TeamCluster::NotFound', 404)
            );
        });

        it('rejects a requested cluster that does not exist', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.resolveConnectedClusterId({
                    teamId: fixture.team.id,
                    requestedTeamClusterId: 'a'.repeat(24)
                }),
                isApplicationError('TeamCluster::NotFound', 404)
            );
        });

        it('rejects a requested cluster that is not connected', async () => {
            const fixture = await createFixture();
            const cluster = await seedCluster(fixture, 'one', { status: TeamClusterStatus.Disconnected });

            await assert.rejects(
                () => service.resolveConnectedClusterId({
                    teamId: fixture.team.id,
                    requestedTeamClusterId: cluster.id
                }),
                isApplicationError('TeamCluster::ConnectedClusterRequired', 409)
            );
        });

        it('rejects a team without any connected cluster', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'one', { status: TeamClusterStatus.Disconnected });

            await assert.rejects(
                () => service.resolveConnectedClusterId({ teamId: fixture.team.id }),
                isApplicationError('TeamCluster::ConnectedClusterRequired', 409)
            );
        });

        it('ignores the connected clusters of another team', async () => {
            const fixture = await createFixture();
            await TeamCluster.create({
                name: 'foreign',
                team: fixture.otherTeam.id,
                createdBy: fixture.owner.id,
                status: TeamClusterStatus.Connected,
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
                    }
                }
            }).save();

            await assert.rejects(
                () => service.resolveConnectedClusterId({ teamId: fixture.team.id }),
                isApplicationError('TeamCluster::ConnectedClusterRequired', 409)
            );
        });
    });

    describe('resolveComputeClusterId', () => {
        it('selects a compute capable cluster', async () => {
            const fixture = await createFixture();
            const compute = await seedCluster(fixture, 'compute', { role: 'compute-node' });

            assert.equal(await service.resolveComputeClusterId({ teamId: fixture.team.id }), compute.id);
        });

        it('skips a storage only cluster', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'storage', { role: 'storage-server' });
            const compute = await seedCluster(fixture, 'compute', { role: 'compute-node' });

            assert.equal(await service.resolveComputeClusterId({ teamId: fixture.team.id }), compute.id);
        });

        it('skips a cluster draining its compute role', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'draining', { drainingCompute: true });
            const healthy = await seedCluster(fixture, 'healthy');

            assert.equal(await service.resolveComputeClusterId({ teamId: fixture.team.id }), healthy.id);
        });

        it('rejects a team whose clusters cannot accept compute work', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'storage', { role: 'storage-server' });

            await assert.rejects(
                () => service.resolveComputeClusterId({ teamId: fixture.team.id }),
                isApplicationError('TeamCluster::ComputeClusterRequired', 409)
            );
        });

        it('rejects a requested cluster that cannot accept compute work', async () => {
            const fixture = await createFixture();
            const storage = await seedCluster(fixture, 'storage', { role: 'storage-server' });

            await assert.rejects(
                () => service.resolveComputeClusterId({
                    teamId: fixture.team.id,
                    requestedTeamClusterId: storage.id
                }),
                isApplicationError('TeamCluster::ComputeCapabilityRequired', 409)
            );
        });

        it('rejects a requested cluster that is not connected', async () => {
            const fixture = await createFixture();
            const cluster = await seedCluster(fixture, 'one', { status: TeamClusterStatus.Disconnected });

            await assert.rejects(
                () => service.resolveComputeClusterId({
                    teamId: fixture.team.id,
                    requestedTeamClusterId: cluster.id
                }),
                isApplicationError('TeamCluster::ComputeClusterRequired', 409)
            );
        });

        it('prefers the least loaded cluster', async () => {
            const fixture = await createFixture();
            const busy = await seedCluster(fixture, 'busy');
            const idle = await seedCluster(fixture, 'idle');
            metricsByClusterId.set(busy.id, metricsWith({ cpu: 90 }));
            metricsByClusterId.set(idle.id, metricsWith({ cpu: 5 }));

            assert.equal(await service.resolveComputeClusterId({ teamId: fixture.team.id }), idle.id);
        });

        it('prefers the cluster that already stores the data', async () => {
            const fixture = await createFixture();
            const local = await seedCluster(fixture, 'local');
            const remote = await seedCluster(fixture, 'remote');
            metricsByClusterId.set(local.id, metricsWith({ cpu: 30 }));
            metricsByClusterId.set(remote.id, metricsWith({ cpu: 20 }));

            assert.equal(
                await service.resolveComputeClusterId({
                    teamId: fixture.team.id,
                    preferredStorageClusterId: local.id
                }),
                local.id
            );
        });

        it('prefers a cluster with metrics over one without when the scores tie', async () => {
            const fixture = await createFixture();
            const known = await seedCluster(fixture, 'known');
            await seedCluster(fixture, 'unknown');
            metricsByClusterId.set(known.id, metricsWith({
                cpu: 50,
                memory: 50,
                disk: 50,
                network: 12_500
            }));

            assert.equal(await service.resolveComputeClusterId({ teamId: fixture.team.id }), known.id);
        });

        it('falls back to the oldest cluster when nothing separates the candidates', async () => {
            const fixture = await createFixture();
            const older = await seedCluster(fixture, 'older', { createdAt: new Date('2024-01-01T00:00:00.000Z') });
            await seedCluster(fixture, 'newer', { createdAt: new Date('2024-06-01T00:00:00.000Z') });

            assert.equal(await service.resolveComputeClusterId({ teamId: fixture.team.id }), older.id);
        });
    });

    describe('resolveStorageClusterId', () => {
        it('selects a storage capable cluster', async () => {
            const fixture = await createFixture();
            const storage = await seedCluster(fixture, 'storage', { role: 'storage-server' });

            assert.equal(await service.resolveStorageClusterId({ teamId: fixture.team.id }), storage.id);
        });

        it('skips a compute only cluster', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'compute', { role: 'compute-node' });
            const storage = await seedCluster(fixture, 'storage', { role: 'storage-server' });

            assert.equal(await service.resolveStorageClusterId({ teamId: fixture.team.id }), storage.id);
        });

        it('skips a cluster draining its storage role', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'draining', { drainingStorage: true });
            const healthy = await seedCluster(fixture, 'healthy');

            assert.equal(await service.resolveStorageClusterId({ teamId: fixture.team.id }), healthy.id);
        });

        it('rejects a team whose clusters cannot accept storage writes', async () => {
            const fixture = await createFixture();
            await seedCluster(fixture, 'compute', { role: 'compute-node' });

            await assert.rejects(
                () => service.resolveStorageClusterId({ teamId: fixture.team.id }),
                isApplicationError('TeamCluster::StorageClusterRequired', 409)
            );
        });

        it('rejects a requested cluster that cannot accept storage writes', async () => {
            const fixture = await createFixture();
            const compute = await seedCluster(fixture, 'compute', { role: 'compute-node' });

            await assert.rejects(
                () => service.resolveStorageClusterId({
                    teamId: fixture.team.id,
                    requestedTeamClusterId: compute.id
                }),
                isApplicationError('TeamCluster::StorageCapabilityRequired', 409)
            );
        });

        it('avoids a cluster past the soft storage limit', async () => {
            const fixture = await createFixture();
            const almostFull = await seedCluster(fixture, 'almost-full');
            const roomy = await seedCluster(fixture, 'roomy');
            metricsByClusterId.set(almostFull.id, metricsWith({ disk: 86 }));
            metricsByClusterId.set(roomy.id, metricsWith({ disk: 80 }));

            assert.equal(await service.resolveStorageClusterId({ teamId: fixture.team.id }), roomy.id);
        });

        it('avoids a cluster past the hard storage limit even against one past the soft limit', async () => {
            const fixture = await createFixture();
            const full = await seedCluster(fixture, 'full');
            const almostFull = await seedCluster(fixture, 'almost-full');
            metricsByClusterId.set(full.id, metricsWith({ disk: 95 }));
            metricsByClusterId.set(almostFull.id, metricsWith({ disk: 86 }));

            assert.equal(await service.resolveStorageClusterId({ teamId: fixture.team.id }), almostFull.id);
        });

        it('prefers the cluster that already runs the compute work', async () => {
            const fixture = await createFixture();
            const local = await seedCluster(fixture, 'local');
            const remote = await seedCluster(fixture, 'remote');
            metricsByClusterId.set(local.id, metricsWith({ cpu: 10 }));
            metricsByClusterId.set(remote.id, metricsWith({ cpu: 5 }));

            assert.equal(
                await service.resolveStorageClusterId({
                    teamId: fixture.team.id,
                    preferredComputeClusterId: local.id
                }),
                local.id
            );
        });
    });

    describe('resolveStorageCluster', () => {
        it('returns the full cluster projection and not only its id', async () => {
            const fixture = await createFixture();
            const cluster = await seedCluster(fixture, 'storage');

            const resolved = await service.resolveStorageCluster({ teamId: fixture.team.id });

            assert.equal(resolved._id, cluster.id);
            assert.equal(resolved.props.name, 'storage');
            assert.equal(resolved.props.team, fixture.team.id);
            assert.equal(resolved.props.status, TeamClusterStatus.Connected);
            assert.ok(resolved.props.createdAt instanceof Date);
        });
    });

    describe('resolveComputeCluster', () => {
        it('returns the full cluster projection and not only its id', async () => {
            const fixture = await createFixture();
            const cluster = await seedCluster(fixture, 'compute');

            const resolved = await service.resolveComputeCluster({ teamId: fixture.team.id });

            assert.equal(resolved._id, cluster.id);
            assert.equal(resolved.props.roleConfig.effectiveRole, 'cluster');
        });
    });
});
