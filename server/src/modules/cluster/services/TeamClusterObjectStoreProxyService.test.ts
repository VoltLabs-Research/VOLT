import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import TeamClusterObjectStoreProxyService, {
    type AuthorizedTeamClusterObjectStoreAccess,
    type TeamClusterObjectStoreProxyServiceDependencies
} from './TeamClusterObjectStoreProxyService';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type {
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayPutStreamRequest
} from '@shared/contracts/types/TeamClusterObjectGateway';

const expectApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

const makeDependencies = (requesterTeam = 'team-1', ownerTeam: string | null = 'team-1') => {
    const authCalls: Array<[string, string]> = [];
    const ownerLookupCalls: string[] = [];
    const gatewayCalls: Array<{ operation: string; args: unknown[] }> = [];
    const listResponse = { keys: ['a'], objects: [{ key: 'a' }] };
    const headResponse = { contentLength: 7, metadata: { source: 'daemon' } };
    const readResponse = {
        ...headResponse,
        headers: { 'content-range': 'bytes 0-6/7' },
        stream: Readable.from(['payload'])
    };

    const objectGatewayClient = {
        async list(ownerClusterId: string, request: TeamClusterObjectGatewayListRequest) {
            gatewayCalls.push({ operation: 'list', args: [ownerClusterId, request] });
            return listResponse;
        },
        async deleteByPrefix(ownerClusterId: string, bucket: string, prefix: string) {
            gatewayCalls.push({ operation: 'deletePrefix', args: [ownerClusterId, bucket, prefix] });
            return 3;
        },
        async head(ownerClusterId: string, bucket: string, objectKey: string) {
            gatewayCalls.push({ operation: 'head', args: [ownerClusterId, bucket, objectKey] });
            return headResponse;
        },
        async getStream(
            ownerClusterId: string,
            bucket: string,
            objectKey: string,
            options?: { skipMetadata?: boolean; rangeHeader?: string }
        ) {
            gatewayCalls.push({ operation: 'openRead', args: [ownerClusterId, bucket, objectKey, options] });
            return readResponse;
        },
        async putStream(ownerClusterId: string, request: TeamClusterObjectGatewayPutStreamRequest) {
            gatewayCalls.push({ operation: 'write', args: [ownerClusterId, request] });
        },
        async deleteObject(ownerClusterId: string, bucket: string, objectKey: string) {
            gatewayCalls.push({ operation: 'delete', args: [ownerClusterId, bucket, objectKey] });
        }
    } satisfies NonNullable<TeamClusterObjectStoreProxyServiceDependencies['objectGatewayClient']>;

    return {
        dependencies: {
            daemonCredentialGuard: {
                async requireByDaemonPassword(requesterClusterId: string, daemonPassword: string) {
                    authCalls.push([requesterClusterId, daemonPassword]);
                    return { props: { team: requesterTeam } };
                }
            },
            async findOwnerClusterById(ownerClusterId: string) {
                ownerLookupCalls.push(ownerClusterId);
                return ownerTeam === null ? null : { props: { team: ownerTeam } };
            },
            objectGatewayClient
        } satisfies TeamClusterObjectStoreProxyServiceDependencies,
        authCalls,
        ownerLookupCalls,
        gatewayCalls,
        listResponse,
        headResponse,
        readResponse
    };
};

test('requireRequesterCredentials preserves missing daemon-header error', () => {
    const service = new TeamClusterObjectStoreProxyService(makeDependencies().dependencies);

    assert.throws(
        () => service.requireRequesterCredentials(undefined, 'password'),
        expectApplicationError('TeamCluster::ObjectStoreProxyUnauthorized', 401)
    );
    assert.throws(
        () => service.requireRequesterCredentials('requester-1', undefined),
        expectApplicationError('TeamCluster::ObjectStoreProxyUnauthorized', 401)
    );
});

test('authorizeOwner authenticates requester, loads owner and enforces same-team access', async () => {
    const missingOwnerFixture = makeDependencies('team-1', null);
    const missingOwnerService = new TeamClusterObjectStoreProxyService(missingOwnerFixture.dependencies);
    const missingOwnerCredentials = missingOwnerService.requireRequesterCredentials('requester-1', 'password');

    await assert.rejects(
        missingOwnerService.authorizeOwner(missingOwnerCredentials, 'owner-1'),
        expectApplicationError('TeamCluster::ObjectStoreProxyOwnerNotFound', 404)
    );
    assert.deepEqual(missingOwnerFixture.authCalls, [['requester-1', 'password']]);
    assert.deepEqual(missingOwnerFixture.ownerLookupCalls, ['owner-1']);

    const otherTeamFixture = makeDependencies('team-1', 'team-2');
    const otherTeamService = new TeamClusterObjectStoreProxyService(otherTeamFixture.dependencies);
    const otherTeamCredentials = otherTeamService.requireRequesterCredentials('requester-1', 'password');

    await assert.rejects(
        otherTeamService.authorizeOwner(otherTeamCredentials, 'owner-1'),
        expectApplicationError('TeamCluster::ObjectStoreProxyForbidden', 403)
    );
    assert.equal(otherTeamFixture.gatewayCalls.length, 0);
});

test('all proxy operations require service-issued authorized access', async () => {
    const fixture = makeDependencies();
    const service = new TeamClusterObjectStoreProxyService(fixture.dependencies);
    const forgedAccess = { ownerClusterId: 'owner-1' } as unknown as AuthorizedTeamClusterObjectStoreAccess;
    const expectForbidden = (error: unknown): boolean => {
        const matches = expectApplicationError('TeamCluster::ObjectStoreProxyForbidden', 403)(error);
        assert.equal(
            (error as ApplicationError).message,
            'The requested owner cluster does not belong to the same team'
        );
        return matches;
    };
    const operations: Array<() => Promise<unknown>> = [
        () => service.list(forgedAccess, { bucket: 'bucket' }),
        () => service.deletePrefix(forgedAccess, 'bucket', 'prefix/'),
        () => service.head(forgedAccess, 'bucket', 'object'),
        () => service.openRead(forgedAccess, 'bucket', 'object'),
        () => service.write(forgedAccess, {
            bucket: 'bucket',
            objectKey: 'object',
            stream: Readable.from([]),
            contentLength: 0,
            metadata: {}
        }),
        () => service.delete(forgedAccess, 'bucket', 'object')
    ];

    for (const operation of operations) {
        await assert.rejects(operation(), expectForbidden);
    }
    assert.equal(fixture.gatewayCalls.length, 0);
});

test('authorized access delegates list/deletePrefix/head/openRead/write/delete with the owner id', async () => {
    const fixture = makeDependencies();
    const service = new TeamClusterObjectStoreProxyService(fixture.dependencies);
    const credentials = service.requireRequesterCredentials('requester-1', 'password');
    const access = await service.authorizeOwner(credentials, 'owner-1');
    const stream = Readable.from(['payload']);

    assert.equal(await service.list(access, { bucket: 'bucket', prefix: 'jobs/' }), fixture.listResponse);
    assert.equal(await service.deletePrefix(access, 'bucket', 'jobs/'), 3);
    assert.equal(await service.head(access, 'bucket', 'object'), fixture.headResponse);
    assert.equal(
        await service.openRead(access, 'bucket', 'object', { skipMetadata: true, rangeHeader: 'bytes=0-6' }),
        fixture.readResponse
    );
    await service.write(access, {
        bucket: 'bucket',
        objectKey: 'object',
        stream,
        contentLength: 7,
        contentType: 'application/custom',
        contentEncoding: 'gzip',
        metadata: { source: 'daemon' }
    });
    await service.delete(access, 'bucket', 'object');

    assert.deepEqual(fixture.gatewayCalls.map((call) => call.operation), [
        'list',
        'deletePrefix',
        'head',
        'openRead',
        'write',
        'delete'
    ]);
    for (const call of fixture.gatewayCalls) {
        assert.equal(call.args[0], 'owner-1');
    }
    const writeRequest = fixture.gatewayCalls[4].args[1] as TeamClusterObjectGatewayPutStreamRequest;
    assert.equal(writeRequest.stream, stream);
    assert.deepEqual(writeRequest.metadata, { source: 'daemon' });
});

test('write preserves required and invalid content-length errors before gateway upload', async () => {
    const fixture = makeDependencies();
    const service = new TeamClusterObjectStoreProxyService(fixture.dependencies);
    const credentials = service.requireRequesterCredentials('requester-1', 'password');
    const access = await service.authorizeOwner(credentials, 'owner-1');

    await assert.rejects(
        service.write(access, {
            bucket: 'bucket',
            objectKey: 'object',
            stream: Readable.from([]),
            metadata: {}
        }),
        expectApplicationError('TeamCluster::ObjectStoreProxyContentLengthRequired', 400)
    );
    await assert.rejects(
        service.write(access, {
            bucket: 'bucket',
            objectKey: 'object',
            stream: Readable.from([]),
            contentLength: Number.NaN,
            metadata: {}
        }),
        expectApplicationError('TeamCluster::ObjectStoreProxyInvalidContentLength', 400)
    );
    assert.equal(fixture.gatewayCalls.length, 0);
});
