import 'reflect-metadata';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import zlib from 'node:zlib';
import TeamClusterObjectGatewayClient from './TeamClusterObjectGatewayClient';

type StoredObject = {
    body: Buffer;
    contentType?: string;
    contentEncoding?: string;
};

const TEST_CLUSTER_ID = 'cluster-1';
const TEST_BUCKET = 'volt-models';
const TEST_OBJECT_KEY = 'path/to/object.glb';
const TEST_DIRECT_ACCESS_TOKEN = 'direct-access-token';

class FakeTeamClusterRepository {
    public findByIdWithSensitiveDataCalls = 0;

    async findByIdWithSensitiveData(teamClusterId: string) {
        this.findByIdWithSensitiveDataCalls += 1;
        return {
            id: teamClusterId,
            props: {
                team: 'team-1'
            }
        };
    }
}

class FakeDaemonCredentialGuard {
    public getDecryptedDaemonPasswordCalls = 0;

    async getDecryptedDaemonPassword(): Promise<string> {
        this.getDecryptedDaemonPasswordCalls += 1;
        return 'cluster-secret';
    }
}

class FakeDirectAccessTokenService {
    public createCalls = 0;
    public issuedSecrets: string[] = [];
    public issuedClaims: unknown[] = [];

    create(secret: string, claims: unknown): string {
        this.createCalls += 1;
        this.issuedSecrets.push(secret);
        this.issuedClaims.push(claims);
        return TEST_DIRECT_ACCESS_TOKEN;
    }
}

class FakeTeamClusterDaemonClient {
    public readonly openTunnelCalls: Array<{ teamClusterId: string; exposureId: string; accessMode: string; }> = [];

    constructor(private readonly port: number) {}

    async openTunnel(teamClusterId: string, exposureId: string, accessMode: string): Promise<net.Socket> {
        this.openTunnelCalls.push({ teamClusterId, exposureId, accessMode });
        return net.connect(this.port, '127.0.0.1');
    }
}

const buildObjectId = (bucket: string, objectKey: string): string => `${bucket}/${objectKey}`;

const readBody = async (request: http.IncomingMessage): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const buildObjectGatewayServer = async () => {
    const objects = new Map<string, StoredObject>();
    const requests: Array<{ method: string; path: string; token?: string; connectionId: string; skipMetadata?: string; }> = [];

    const server = http.createServer(async (request, response) => {
        const method = request.method || 'GET';
        const url = new URL(request.url || '/', 'http://127.0.0.1');
        requests.push({
            method,
            path: `${url.pathname}${url.search}`,
            connectionId: `${request.socket.remoteAddress}:${request.socket.remotePort}`,
            skipMetadata: typeof request.headers['x-volt-object-store-skip-metadata'] === 'string'
                ? request.headers['x-volt-object-store-skip-metadata']
                : undefined,
            token: typeof request.headers['x-team-cluster-direct-access-token'] === 'string'
                ? request.headers['x-team-cluster-direct-access-token']
                : undefined
        });

        const pathParts = url.pathname.split('/').filter(Boolean);
        const bucket = decodeURIComponent(pathParts[4] || '');
        const encodedObjectKey = pathParts.slice(6).join('/');
        const objectKey = decodeURIComponent(encodedObjectKey);

        if (method === 'GET' && pathParts.length === 6) {
            const prefix = url.searchParams.get('prefix') || '';
            const keys = Array.from(objects.keys())
                .filter((key) => key.startsWith(`${bucket}/${prefix}`))
                .map((key) => key.slice(bucket.length + 1));

            const body = Buffer.from(JSON.stringify({ keys }));
            response.statusCode = 200;
            response.setHeader('content-type', 'application/json');
            response.setHeader('content-length', String(body.length));
            response.end(body);
            return;
        }

        if (method === 'DELETE' && pathParts.length === 6) {
            const prefix = url.searchParams.get('prefix') || '';
            const matchingKeys = Array.from(objects.keys()).filter((key) => key.startsWith(`${bucket}/${prefix}`));
            for (const key of matchingKeys) {
                objects.delete(key);
            }

            const body = Buffer.from(JSON.stringify({ deletedCount: matchingKeys.length }));
            response.statusCode = 200;
            response.setHeader('content-type', 'application/json');
            response.setHeader('content-length', String(body.length));
            response.end(body);
            return;
        }

        if (method === 'PUT') {
            const body = await readBody(request);
            objects.set(buildObjectId(bucket, objectKey), {
                body,
                contentType: typeof request.headers['content-type'] === 'string'
                    ? request.headers['content-type']
                    : undefined,
                contentEncoding: typeof request.headers['content-encoding'] === 'string'
                    ? request.headers['content-encoding']
                    : undefined
            });
            response.statusCode = 201;
            response.end();
            return;
        }

        const storedObject = objects.get(buildObjectId(bucket, objectKey));
        if (!storedObject) {
            const body = Buffer.from(JSON.stringify({ message: 'missing' }));
            response.statusCode = 404;
            response.setHeader('content-type', 'application/json');
            response.setHeader('content-length', String(body.length));
            response.end(body);
            return;
        }

        if (method === 'HEAD') {
            response.statusCode = 200;
            response.setHeader('content-length', String(storedObject.body.length));
            response.setHeader('content-type', storedObject.contentType || 'application/octet-stream');
            if (storedObject.contentEncoding) {
                response.setHeader('content-encoding', storedObject.contentEncoding);
            }
            response.end();
            return;
        }

        if (method === 'GET') {
            response.statusCode = 200;
            response.setHeader('content-length', String(storedObject.body.length));
            response.setHeader('content-type', storedObject.contentType || 'application/octet-stream');
            if (storedObject.contentEncoding) {
                response.setHeader('content-encoding', storedObject.contentEncoding);
            }
            response.end(storedObject.body);
            return;
        }

        if (method === 'DELETE') {
            objects.delete(buildObjectId(bucket, objectKey));
            response.statusCode = 204;
            response.end();
            return;
        }

        response.statusCode = 405;
        response.end();
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start object gateway test server');
    }

    return {
        server,
        requests,
        port: address.port,
        seedObject: (bucket: string, objectKey: string, object: StoredObject) => {
            objects.set(buildObjectId(bucket, objectKey), object);
        }
    };
};

const createClientHarness = (port: number) => {
    const daemonClient = new FakeTeamClusterDaemonClient(port);
    const repository = new FakeTeamClusterRepository();
    const credentialGuard = new FakeDaemonCredentialGuard();
    const tokenService = new FakeDirectAccessTokenService();

    return {
        daemonClient,
        repository,
        credentialGuard,
        tokenService,
        client: new TeamClusterObjectGatewayClient(
            daemonClient as any,
            repository as any,
            credentialGuard as any,
            tokenService as any
        )
    };
};

test('TeamClusterObjectGatewayClient performs object gateway operations through the reverse-channel tunnel', async () => {
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'true';

    const { server, requests, port } = await buildObjectGatewayServer();
    const harness = createClientHarness(port);

    try {
        const payload = Buffer.from('glb-payload');

        await harness.client.putBuffer(TEST_CLUSTER_ID, {
            bucket: TEST_BUCKET,
            objectKey: TEST_OBJECT_KEY,
            buffer: payload,
            contentLength: payload.length,
            contentType: 'model/gltf-binary'
        });

        assert.equal(await harness.client.exists(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY), true);

        const head = await harness.client.head(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.equal(head.contentLength, payload.length);
        assert.equal(head.contentType, 'model/gltf-binary');

        const buffer = await harness.client.getBuffer(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.deepEqual(buffer, payload);

        const list = await harness.client.list(TEST_CLUSTER_ID, {
            bucket: TEST_BUCKET,
            prefix: 'path/to'
        });
        assert.deepEqual(list.keys, [TEST_OBJECT_KEY]);

        const deletedCount = await harness.client.deleteByPrefix(TEST_CLUSTER_ID, TEST_BUCKET, 'path/');
        assert.equal(deletedCount, 1);
        assert.equal(await harness.client.exists(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY), false);

        assert.ok(requests.some((entry) => entry.method === 'HEAD'));
        assert.ok(requests.every((entry) => entry.token === TEST_DIRECT_ACCESS_TOKEN));
        assert.ok(harness.daemonClient.openTunnelCalls.length < requests.length);
        assert.ok(new Set(requests.map((entry) => entry.connectionId)).size < requests.length);
        assert.ok(harness.daemonClient.openTunnelCalls.every((entry) => entry.teamClusterId === TEST_CLUSTER_ID));
        assert.ok(harness.daemonClient.openTunnelCalls.every((entry) => entry.exposureId === 'daemon:object-gateway'));
        assert.ok(harness.daemonClient.openTunnelCalls.every((entry) => entry.accessMode === 'http'));
        assert.equal(harness.repository.findByIdWithSensitiveDataCalls, 1);
        assert.equal(harness.credentialGuard.getDecryptedDaemonPasswordCalls, 1);
        assert.equal(harness.tokenService.createCalls, 1);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test('TeamClusterObjectGatewayClient.getStream preserves the full object body from the first byte', async () => {
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'true';

    const { server, port } = await buildObjectGatewayServer();
    const harness = createClientHarness(port);

    try {
        const payload = Buffer.concat([
            Buffer.from('glTF'),
            Buffer.from(Array.from({ length: 128 * 1024 }, (_, index) => index % 251))
        ]);

        await harness.client.putBuffer(TEST_CLUSTER_ID, {
            bucket: TEST_BUCKET,
            objectKey: TEST_OBJECT_KEY,
            buffer: payload,
            contentLength: payload.length,
            contentType: 'model/gltf-binary'
        });

        const response = await harness.client.getStream(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        const streamedChunks: Buffer[] = [];

        for await (const chunk of response.stream) {
            streamedChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        assert.deepEqual(Buffer.concat(streamedChunks), payload);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test('TeamClusterObjectGatewayClient preserves gzipped object bytes when the response advertises content-encoding', async () => {
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'true';

    const { server, port, seedObject } = await buildObjectGatewayServer();
    const harness = createClientHarness(port);

    try {
        const compressed = zlib.gzipSync(Buffer.from('dump-payload'));
        seedObject(TEST_BUCKET, TEST_OBJECT_KEY, {
            body: compressed,
            contentType: 'application/gzip',
            contentEncoding: 'gzip'
        });

        const head = await harness.client.head(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.equal(head.contentEncoding, 'gzip');

        const buffer = await harness.client.getBuffer(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.deepEqual(buffer, compressed);
        assert.deepEqual(zlib.gunzipSync(buffer), Buffer.from('dump-payload'));
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test('TeamClusterObjectGatewayClient can request stream-only reads without metadata prefetch', async () => {
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'true';

    const { server, port, requests, seedObject } = await buildObjectGatewayServer();
    const harness = createClientHarness(port);

    try {
        const payload = Buffer.from('stream-only-payload');
        seedObject(TEST_BUCKET, TEST_OBJECT_KEY, {
            body: payload,
            contentType: 'application/octet-stream'
        });

        const response = await harness.client.getStream(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY, {
            skipMetadata: true
        });
        const streamedChunks: Buffer[] = [];

        for await (const chunk of response.stream) {
            streamedChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        assert.deepEqual(Buffer.concat(streamedChunks), payload);
        assert.equal(requests[requests.length - 1]?.skipMetadata, '1');
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test('TeamClusterObjectGatewayClient honors feature flags without attempting an object gateway tunnel', async () => {
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'false';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'false';

    const harness = createClientHarness(1);

    try {
        await assert.rejects(
            () => harness.client.getBuffer(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY),
            (error: any) => error?.statusCode === 503
        );

        await assert.rejects(
            () => harness.client.putBuffer(TEST_CLUSTER_ID, {
                bucket: TEST_BUCKET,
                objectKey: TEST_OBJECT_KEY,
                buffer: Buffer.from('x'),
                contentLength: 1
            }),
            (error: any) => error?.statusCode === 503
        );

        assert.equal(harness.daemonClient.openTunnelCalls.length, 0);
        assert.equal(harness.repository.findByIdWithSensitiveDataCalls, 0);
        assert.equal(harness.credentialGuard.getDecryptedDaemonPasswordCalls, 0);
        assert.equal(harness.tokenService.createCalls, 0);
    } finally {
        process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'true';
        process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'true';
    }
});
