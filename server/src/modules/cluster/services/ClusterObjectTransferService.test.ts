import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import ClusterObjectTransferService, {
    type ClusterObjectTransferServiceDependencies
} from './ClusterObjectTransferService';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { ClusterObjectAccessClaims } from '@shared/contracts/types/ClusterObjectGateway';
import type {
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayPutStreamRequest,
    TeamClusterObjectGatewayStreamResponse
} from '@shared/contracts/types/TeamClusterObjectGateway';

const claims = (overrides: Partial<ClusterObjectAccessClaims> = {}): ClusterObjectAccessClaims => ({
    kind: 'cluster-object',
    operation: 'write',
    teamId: 'team-1',
    userId: 'user-1',
    ownerClusterId: 'owner-1',
    bucket: 'artifacts',
    objectKey: 'jobs/result.bin',
    resourceKind: 'analysis',
    resourceId: 'analysis-1',
    iat: 1,
    exp: 2,
    ...overrides
});

const expectApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

const makeDependencies = (verifiedClaims: ClusterObjectAccessClaims | null) => {
    const putCalls: Array<{
        ownerClusterId: string;
        request: TeamClusterObjectGatewayPutStreamRequest;
    }> = [];
    const headCalls: Array<[string, string, string]> = [];
    const readCalls: Array<[
        string,
        string,
        string,
        { skipMetadata?: boolean; rangeHeader?: string } | undefined
    ]> = [];
    const headResponse: TeamClusterObjectGatewayHeadResponse = {
        contentLength: 12,
        contentType: 'application/octet-stream',
        metadata: {}
    };
    const readResponse: TeamClusterObjectGatewayStreamResponse = {
        ...headResponse,
        headers: { 'accept-ranges': 'bytes' },
        stream: Readable.from(['result'])
    };

    const objectGatewayClient = {
        async putStream(ownerClusterId, request) {
            putCalls.push({
 ownerClusterId, request 
});
        },
        async head(ownerClusterId, bucket, objectKey) {
            headCalls.push([ownerClusterId, bucket, objectKey]);
            return headResponse;
        },
        async getStream(ownerClusterId, bucket, objectKey, options) {
            readCalls.push([ownerClusterId, bucket, objectKey, options]);
            return readResponse;
        }
    } satisfies NonNullable<ClusterObjectTransferServiceDependencies['objectGatewayClient']>;

    return {
        dependencies: {
            signedUrlService: {
                verify: (token: string) => token === 'valid-token' ? verifiedClaims : null
            },
            objectGatewayClient
        } satisfies ClusterObjectTransferServiceDependencies,
        putCalls,
        headCalls,
        readCalls,
        headResponse,
        readResponse
    };
};

const expectApplicationErrorWithMessage = (
    code: string,
    statusCode: number,
    message: string
) => (error: unknown): boolean => {
    const matches = expectApplicationError(code, statusCode)(error);
    assert.equal((error as ApplicationError).message, message);
    return matches;
};

test('operations reject missing, invalid, cross-team and wrong-operation claims before gateway work', async () => {
    const writeFixture = makeDependencies(claims());
    const writeService = new ClusterObjectTransferService(writeFixture.dependencies);
    const invalidSignedUrl = expectApplicationErrorWithMessage(
        'ClusterObject::InvalidSignedUrl',
        401,
        'Object URL is invalid or expired'
    );

    await assert.rejects(
        writeService.write('team-1', undefined, {
            stream: Readable.from(['payload'])
        }),
        invalidSignedUrl
    );
    await assert.rejects(
        writeService.write('team-1', 'invalid-token', {
            stream: Readable.from(['payload'])
        }),
        invalidSignedUrl
    );
    await assert.rejects(
        writeService.write('another-team', 'valid-token', {
            stream: Readable.from(['payload']),
            contentLength: 7
        }),
        invalidSignedUrl
    );
    await assert.rejects(
        writeService.head('team-1', 'valid-token'),
        invalidSignedUrl
    );
    await assert.rejects(
        writeService.openRead('team-1', 'valid-token'),
        invalidSignedUrl
    );

    const readFixture = makeDependencies(claims({ operation: 'read' }));
    const readService = new ClusterObjectTransferService(readFixture.dependencies);
    await assert.rejects(
        readService.write('team-1', 'valid-token', {
            stream: Readable.from(['payload']),
            contentLength: 7
        }),
        invalidSignedUrl
    );

    assert.equal(writeFixture.putCalls.length, 0);
    assert.equal(writeFixture.headCalls.length, 0);
    assert.equal(writeFixture.readCalls.length, 0);
    assert.equal(readFixture.putCalls.length, 0);
});

test('write preserves content-length validation codes, messages and signed-size invariant', async () => {
    const fixture = makeDependencies(claims({ contentLength: 7 }));
    const service = new ClusterObjectTransferService(fixture.dependencies);

    await assert.rejects(
        service.write('team-1', 'valid-token', {
            stream: Readable.from(['payload'])
        }),
        expectApplicationErrorWithMessage(
            'ClusterObject::ContentLengthRequired',
            400,
            'content-length header is required for object uploads'
        )
    );
    await assert.rejects(
        service.write('team-1', 'valid-token', {
            stream: Readable.from(['payload']),
            contentLength: Number.NaN
        }),
        expectApplicationErrorWithMessage(
            'ClusterObject::ContentLengthRequired',
            400,
            'content-length header is required for object uploads'
        )
    );
    await assert.rejects(
        service.write('team-1', 'valid-token', {
            stream: Readable.from(['payload']),
            contentLength: 8
        }),
        expectApplicationErrorWithMessage(
            'ClusterObject::ContentLengthMismatch',
            400,
            'Uploaded object size does not match the signed URL'
        )
    );
    assert.equal(fixture.putCalls.length, 0);
});

test('write forwards the original stream and claim-derived object data without buffering', async () => {
    const metadata = { resource: 'analysis-1' };
    const fixture = makeDependencies(claims({
        contentLength: 7,
        contentType: 'application/custom',
        metadata
    }));
    const service = new ClusterObjectTransferService(fixture.dependencies);
    const stream = Readable.from(['payload']);

    await service.write('team-1', 'valid-token', {
        stream,
        contentLength: 7,
        contentEncoding: 'gzip'
    });

    assert.equal(fixture.putCalls.length, 1);
    assert.equal(fixture.putCalls[0].ownerClusterId, 'owner-1');
    assert.deepEqual(fixture.putCalls[0].request, {
        bucket: 'artifacts',
        objectKey: 'jobs/result.bin',
        stream,
        contentLength: 7,
        contentType: 'application/custom',
        contentEncoding: 'gzip',
        metadata
    });
    assert.equal(fixture.putCalls[0].request.stream, stream);
});

test('head and openRead authorize read claims and forward range streaming options', async () => {
    const fixture = makeDependencies(claims({ operation: 'read' }));
    const service = new ClusterObjectTransferService(fixture.dependencies);

    const head = await service.head('team-1', 'valid-token');
    const read = await service.openRead('team-1', 'valid-token', {
        rangeHeader: 'bytes=10-19'
    });

    assert.equal(head, fixture.headResponse);
    assert.equal(read, fixture.readResponse);
    assert.deepEqual(fixture.headCalls, [['owner-1', 'artifacts', 'jobs/result.bin']]);
    assert.deepEqual(fixture.readCalls, [[
        'owner-1',
        'artifacts',
        'jobs/result.bin',
        {
 skipMetadata: true, rangeHeader: 'bytes=10-19' 
}
    ]]);
});
