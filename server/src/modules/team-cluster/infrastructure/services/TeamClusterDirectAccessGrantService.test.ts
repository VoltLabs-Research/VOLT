import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import TeamClusterDirectAccessGrantService from './TeamClusterDirectAccessGrantService';
import TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@shared/infrastructure/contracts/team-cluster';

class StubTeamClusterRepository {
    public readonly findByIdCalls: string[] = [];

    async findByIdWithSensitiveData(id: string): Promise<TeamCluster | null> {
        this.findByIdCalls.push(id);
        return null;
    }
}

class StubExposureRegistryService {
    findTeamClusterExposure(): null {
        return null;
    }
}

class StubDaemonCredentialGuard {
    constructor(private readonly cluster: TeamCluster) {}

    async requireByDaemonPassword(): Promise<TeamCluster> {
        return this.cluster;
    }

    async getDecryptedDaemonPassword(): Promise<string> {
        return 'decrypted-daemon-password';
    }
}

class StubTokenService {
    public readonly createdTokens: Array<{ secret: string; claims: Record<string, unknown> }> = [];

    create(secret: string, claims: Record<string, unknown>): string {
        this.createdTokens.push({ secret, claims });
        return 'direct-access-token';
    }
}

class StubVoltServerObjectGatewayService {
    public readonly issueGrantCalls: Array<{ requester: { kind: 'daemon' | 'server'; id: string; }; teamId: string }> = [];

    issueGrant(requester: { kind: 'daemon' | 'server'; id: string; }, teamId: string) {
        this.issueGrantCalls.push({ requester, teamId });

        return {
            ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            exposureName: 'object-gateway',
            exposureId: 'volt-server:object-gateway',
            accessMode: 'http',
            endpoint: {
                protocol: 'http' as const,
                host: 'volt-server',
                port: 8000
            },
            token: 'direct-access-token',
            expiresAt: new Date(Date.now() + 60_000).toISOString()
        };
    }
}

const buildCluster = (): TeamCluster => {
    return new TeamCluster('compute-1', {
        name: 'Compute 1',
        team: 'team-1',
        createdBy: 'user-1',
        status: TeamClusterStatus.Connected,
        enrollmentTokenHash: null,
        installedVersion: 'dev',
        installRoot: '/opt/volt',
        lastHeartbeatAt: new Date(),
        lastDisconnectAt: null,
        services: {
            minio: {
                port: 9000,
                username: 'enc',
                password: 'enc'
            },
            redis: {
                port: 6379,
                username: 'enc',
                password: 'enc'
            },
            mongodb: {
                port: 27017,
                username: 'enc',
                password: 'enc'
            },
            daemon: {
                port: 8080,
                password: 'enc'
            }
        },
        queueConcurrency: {
            analysis: 1,
            rasterizer: 1,
            glbPreprocessing: 1,
            sshImport: 1
        },
        roleConfig: {
            desiredRole: 'compute-node',
            effectiveRole: 'compute-node',
            runtimeVersion: 1,
            draining: {
                compute: false,
                storage: false
            },
            lastAppliedAt: null
        },
        effectiveCapabilities: {
            acceptsComputeJobs: true,
            acceptsStorageWrites: false,
            servesStorageReads: true,
            servesArtifactDownloads: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
    });
};

test('authorizeDaemonGrant delegates Volt server owner grants without querying TeamCluster repository', async () => {
    const repository = new StubTeamClusterRepository();
    const voltServerGateway = new StubVoltServerObjectGatewayService();

    const service = new TeamClusterDirectAccessGrantService(
        repository as any,
        new StubExposureRegistryService() as any,
        new StubDaemonCredentialGuard(buildCluster()) as any,
        new StubTokenService() as any,
        voltServerGateway as any
    );

    const result = await service.authorizeDaemonGrant(
        'compute-1',
        'daemon-password',
        {
            ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            exposureName: 'object-gateway',
            accessMode: TeamClusterServiceExposureAccessMode.Http
        }
    );

    assert.equal(repository.findByIdCalls.length, 0);
    assert.equal(voltServerGateway.issueGrantCalls.length, 1);
    assert.equal(voltServerGateway.issueGrantCalls[0]?.requester.kind, 'daemon');
    assert.equal(voltServerGateway.issueGrantCalls[0]?.requester.id, 'compute-1');
    assert.equal(voltServerGateway.issueGrantCalls[0]?.teamId, 'team-1');
    assert.equal(result.ownerClusterId, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID);
    assert.equal(result.endpoint.host, 'volt-server');
});
