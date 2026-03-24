import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ClusterRoleAwareSelectionService } from './ClusterRoleAwareSelectionService';
import TeamCluster, {
    TeamClusterStatus,
    createDefaultTeamClusterEffectiveCapabilities,
    createDefaultTeamClusterRoleConfig
} from '@modules/team-cluster/domain/entities/TeamCluster';

import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

const createTeamCluster = (
    id: string,
    overrides: Partial<TeamCluster['props']> = {}
): TeamCluster => {
    return new TeamCluster(id, {
        name: id,
        team: 'team-1',
        createdBy: 'user-1',
        status: TeamClusterStatus.Connected,
        enrollmentTokenHash: null,
        installedVersion: null,
        installRoot: null,
        lastHeartbeatAt: null,
        lastDisconnectAt: null,
        services: {
            minio: { port: null },
            redis: { port: null },
            mongodb: { port: null },
            daemon: { port: null }
        },
        queueConcurrency: {
            analysis: 1,
            rasterizer: 1,
            glbPreprocessing: 1,
            sshImport: 1
        },
        roleConfig: createDefaultTeamClusterRoleConfig(),
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities(),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides
    });
};

class FakeTeamClusterRepository implements Pick<ITeamClusterRepository, 'findById' | 'export'> {
    constructor(private readonly clusters: TeamCluster[]) {}

    async findById(id: string): Promise<TeamCluster | null> {
        return this.clusters.find((cluster) => cluster.id === id) ?? null;
    }

    async export(): Promise<TeamCluster[]> {
        return this.clusters;
    }
}

class FakeSystemMetricsRepository implements Pick<ISystemMetricsRepository, 'getLatestByClusterId'> {
    constructor(private readonly metricsByClusterId: Record<string, SystemMetrics | null>) {}

    async getLatestByClusterId(clusterId: string): Promise<SystemMetrics | null> {
        return this.metricsByClusterId[clusterId] ?? null;
    }
}

const createMetrics = (clusterId: string, cpuUsage: number, memoryUsage: number): SystemMetrics => ({
    timestamp: new Date('2026-03-23T00:00:00.000Z'),
    serverId: clusterId,
    teamClusterId: clusterId,
    cpu: {
        usage: cpuUsage,
        cores: 8,
        loadAvg: [],
        coresUsage: []
    },
    memory: {
        total: 32,
        used: 16,
        free: 16,
        usagePercent: memoryUsage
    },
    disk: {
        total: 500,
        used: 100,
        free: 400,
        usagePercent: 20
    },
    network: {
        incoming: 1_000,
        outgoing: 1_000,
        total: 2_000
    },
    responseTime: 10,
    responseTimes: {
        mongodb: 10,
        redis: 10,
        minio: 10,
        self: 10,
        average: 10
    },
    diskOperations: {
        read: 0,
        write: 0,
        speed: 0
    },
    status: 'Healthy',
    uptime: 1_000,
    mongodb: null
});

test('ClusterRoleAwareSelectionService selects storage and compute clusters by effective capabilities', async () => {
    const storageCluster = createTeamCluster('storage-1', {
        roleConfig: createDefaultTeamClusterRoleConfig('storage-server'),
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities('storage-server')
    });
    const computeCluster = createTeamCluster('compute-1', {
        roleConfig: createDefaultTeamClusterRoleConfig('compute-node'),
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities('compute-node')
    });

    const service = new ClusterRoleAwareSelectionService(
        new FakeTeamClusterRepository([storageCluster, computeCluster]) as unknown as ITeamClusterRepository,
        new FakeSystemMetricsRepository({
            'storage-1': createMetrics('storage-1', 40, 40),
            'compute-1': createMetrics('compute-1', 20, 20)
        }) as unknown as ISystemMetricsRepository
    );

    assert.equal(await service.resolveStorageClusterId({ teamId: 'team-1' }), 'storage-1');
    assert.equal(await service.resolveComputeClusterId({ teamId: 'team-1' }), 'compute-1');
});

test('ClusterRoleAwareSelectionService penalizes remote compute when storage and compute can co-locate', async () => {
    const colocatedCluster = createTeamCluster('cluster-1', {
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities('cluster')
    });
    const remoteComputeCluster = createTeamCluster('compute-2', {
        roleConfig: createDefaultTeamClusterRoleConfig('compute-node'),
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities('compute-node')
    });

    const service = new ClusterRoleAwareSelectionService(
        new FakeTeamClusterRepository([colocatedCluster, remoteComputeCluster]) as unknown as ITeamClusterRepository,
        new FakeSystemMetricsRepository({
            'cluster-1': createMetrics('cluster-1', 35, 35),
            'compute-2': createMetrics('compute-2', 25, 25)
        }) as unknown as ISystemMetricsRepository
    );

    assert.equal(await service.resolveComputeClusterId({
        teamId: 'team-1',
        preferredStorageClusterId: 'cluster-1'
    }), 'cluster-1');
});

test('ClusterRoleAwareSelectionService rejects requested clusters without the required effective capability', async () => {
    const storageCluster = createTeamCluster('storage-1', {
        roleConfig: createDefaultTeamClusterRoleConfig('storage-server'),
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities('storage-server')
    });

    const service = new ClusterRoleAwareSelectionService(
        new FakeTeamClusterRepository([storageCluster]) as unknown as ITeamClusterRepository,
        new FakeSystemMetricsRepository({}) as unknown as ISystemMetricsRepository
    );

    await assert.rejects(
        () => service.resolveComputeClusterId({
            teamId: 'team-1',
            requestedTeamClusterId: 'storage-1'
        }),
        (error: unknown) => error instanceof Error && error.message.includes('cannot accept compute work')
    );
});

test('ClusterRoleAwareSelectionService excludes storage clusters above the hard disk limit', async () => {
    const saturatedStorageCluster = createTeamCluster('storage-hard-limit', {
        roleConfig: createDefaultTeamClusterRoleConfig('storage-server'),
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities('storage-server')
    });
    const healthyStorageCluster = createTeamCluster('storage-healthy', {
        roleConfig: createDefaultTeamClusterRoleConfig('storage-server'),
        effectiveCapabilities: createDefaultTeamClusterEffectiveCapabilities('storage-server')
    });

    const service = new ClusterRoleAwareSelectionService(
        new FakeTeamClusterRepository([saturatedStorageCluster, healthyStorageCluster]) as unknown as ITeamClusterRepository,
        new FakeSystemMetricsRepository({
            'storage-hard-limit': {
                ...createMetrics('storage-hard-limit', 20, 20),
                disk: {
                    total: 500,
                    used: 470,
                    free: 30,
                    usagePercent: 94
                }
            },
            'storage-healthy': createMetrics('storage-healthy', 30, 30)
        }) as unknown as ISystemMetricsRepository
    );

    assert.equal(await service.resolveStorageClusterId({ teamId: 'team-1' }), 'storage-healthy');

    await assert.rejects(
        () => service.resolveStorageClusterId({
            teamId: 'team-1',
            requestedTeamClusterId: 'storage-hard-limit'
        }),
        (error: unknown) => error instanceof Error && error.message.includes('hard storage limit')
    );
});
